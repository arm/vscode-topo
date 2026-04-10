import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { TargetTreeDataProvider } from './targetTreeDataProvider';
import * as manifest from '../manifest';
import { Target } from './target';
import { TargetStore } from './targetStore';
import { logger } from '../util/logger';
import { ContainersManager } from './containersManager';
import { getTreeItemIcon } from './targetTreeTargetItem';
import { isTargetReady } from '../util/targetState';
import { TargetItem } from '../util/types';
import { TopoCli } from '../topoCli';

function buildQuickPickItems(
    availableHosts: string[],
    filter: string,
    configureItem: vscode.QuickPickItem,
): vscode.QuickPickItem[] {
    const hostItems: vscode.QuickPickItem[] = availableHosts.map((host) => ({
        label: host,
    }));
    const trimmed = filter.trim();
    const isNovelEntry =
        trimmed.length > 0 &&
        !availableHosts.some((h) => h.toLowerCase() === trimmed.toLowerCase());
    const manualItem: vscode.QuickPickItem | undefined = isNovelEntry
        ? { label: trimmed, description: 'Add new SSH target' }
        : undefined;
    return [
        ...(manualItem ? [manualItem] : []),
        ...hostItems,
        { label: '', kind: vscode.QuickPickItemKind.Separator },
        configureItem,
    ];
}

export class TargetManager {
    public static readonly viewId = `${manifest.PACKAGE_NAME}.target-manager`;
    public static readonly refreshCommand = `${manifest.PACKAGE_NAME}.refresh`;
    public static readonly addTargetCommand = `${manifest.PACKAGE_NAME}.addTarget`;
    public static readonly FocusViewCommand = `${TargetManager.viewId}.focus`;
    public static readonly statusPriority = 100;

    private statusBarItem: vscode.StatusBarItem | undefined;

    private static readonly configureSshTargetsLabel =
        '$(gear) Configure SSH targets';

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly targetTreeDataProvider: TargetTreeDataProvider,
        private readonly targetStore: TargetStore,
        private readonly containersManager: ContainersManager,
        private readonly topoCli: TopoCli,
    ) {}

    public async activate() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            TargetManager.viewId,
            vscode.StatusBarAlignment.Left,
            TargetManager.statusPriority,
        );
        this.statusBarItem.command = TargetManager.FocusViewCommand;
        const treeView = vscode.window.createTreeView(TargetManager.viewId, {
            treeDataProvider: this.targetTreeDataProvider,
            showCollapseAll: true,
        });
        await this.refreshTargetVisualisation();

        this.context.subscriptions.push(
            this.statusBarItem,
            treeView,
            vscode.commands.registerCommand(TargetManager.refreshCommand, () =>
                this.targetTreeDataProvider.refresh(),
            ),
            vscode.commands.registerCommand(
                TargetManager.addTargetCommand,
                () => this.addTarget(),
            ),
            this.targetStore.onChanged(() => this.refreshTargetVisualisation()),
            this.containersManager.onDataUpdate(() =>
                this.refreshTargetVisualisation(),
            ),
        );
    }

    private async addTarget(): Promise<Target | undefined> {
        const ssh = await this.promptForSshTarget();
        if (!ssh?.trim()) {
            return;
        }

        const newTarget = new Target(ssh);

        try {
            await this.targetStore.addTarget(newTarget);
        } catch (error) {
            const errorMsg = `Failed to add target`;
            logger.warn(errorMsg, error);
            vscode.window.showWarningMessage(errorMsg);
            return;
        }
        await this.targetStore.setSelected(newTarget.ssh);
    }

    private promptForSshTarget(): Promise<string | undefined> {
        const sshHosts = this.getSshHostsFromConfig();
        const existingTargets = new Set(
            this.targetStore.getTargets().map((t) => t.ssh),
        );
        const availableHosts = sshHosts.filter(
            (host) => !existingTargets.has(host),
        );

        const configureItem: vscode.QuickPickItem = {
            label: TargetManager.configureSshTargetsLabel,
            description: '~/.ssh/config',
            alwaysShow: true,
        };

        const quickPick = vscode.window.createQuickPick();
        quickPick.title = 'Add new target';
        quickPick.placeholder =
            'Select a host or type a connection string (e.g. root@192.168.1.1)';
        quickPick.items = buildQuickPickItems(
            availableHosts,
            '',
            configureItem,
        );

        quickPick.onDidChangeValue((value) => {
            quickPick.items = buildQuickPickItems(
                availableHosts,
                value,
                configureItem,
            );
        });

        return new Promise<string | undefined>((resolve) => {
            let accepted = false;
            quickPick.onDidAccept(async () => {
                accepted = true;
                const selected = quickPick.selectedItems[0];
                quickPick.hide();
                if (!selected) {
                    resolve(undefined);
                    return;
                }
                if (selected === configureItem) {
                    await this.openSshConfig();
                    resolve(undefined);
                    return;
                }
                resolve(selected.label);
            });
            quickPick.onDidHide(() => {
                quickPick.dispose();
                if (!accepted) {
                    resolve(undefined);
                }
            });
            quickPick.show();
        });
    }

    private async openSshConfig(): Promise<void> {
        const sshConfigPath = path.join(os.homedir(), '.ssh', 'config');
        if (fs.existsSync(sshConfigPath)) {
            await vscode.window.showTextDocument(
                vscode.Uri.file(sshConfigPath),
            );
        } else {
            vscode.window.showWarningMessage(
                `SSH config not found at ${sshConfigPath}`,
            );
        }
    }

    private getSshHostsFromConfig(): string[] {
        try {
            const sshConfigPath = path.join(os.homedir(), '.ssh', 'config');
            return this.topoCli.listCandidateTargets(sshConfigPath);
        } catch (error) {
            logger.debug('Failed to list SSH hosts from config', error);
            return [];
        }
    }

    protected updateStatusBar(selectedTarget: TargetItem | undefined): void {
        if (!this.statusBarItem) {
            return;
        }
        if (selectedTarget) {
            const targetState = this.containersManager.getTargetStateSnapshot();
            const connectionReady =
                selectedTarget.ssh === targetState.targetSsh;
            const targetTreeIcon = getTreeItemIcon(
                true,
                connectionReady,
                isTargetReady(targetState),
            );
            const iconId = targetTreeIcon?.id || 'pass-filled';
            this.statusBarItem.text = `$(${iconId}) ${selectedTarget.ssh}`;
            this.statusBarItem.tooltip = `Connection String: ${selectedTarget.ssh}`;
            this.statusBarItem.show();
        } else {
            this.statusBarItem.hide();
        }
    }

    private async refreshTargetVisualisation(): Promise<void> {
        const selectedTarget = await this.targetStore.getSelectedTarget();
        this.updateStatusBar(selectedTarget);
    }
}
