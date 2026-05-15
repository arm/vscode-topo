import * as vscode from 'vscode';
import { TargetTreeDataProvider } from './targetTreeDataProvider';
import * as manifest from '../manifest';
import { TargetStore } from '../target/targetStore';
import { logger } from '../util/logger';
import { ContainersManager } from '../target/containersManager';
import { getTargetTreeItemIcon } from './targetTreeItem';
import { defaultSshConfigPath, getHosts } from '../util/ssh';
import {
    refreshTargetContainersCommand,
    refreshTargetStateCommand,
} from '../refreshCommands';
import { TargetStatus } from '../util/types';

export function buildQuickPickItems(
    availableHosts: string[],
    filter: string,
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
    return [...(manualItem ? [manualItem] : []), ...hostItems];
}

function getStatusBarItemText(target: string, status: TargetStatus): string {
    const icon = getTargetTreeItemIcon(true, status);
    const iconId = icon?.id || 'pass-filled';
    return `$(${iconId}) ${target}`;
}

export class TargetManager {
    public static readonly viewId = `${manifest.PACKAGE_NAME}.target-manager`;
    public static readonly addTargetCommand = `${manifest.PACKAGE_NAME}.addTarget`;
    public static readonly FocusViewCommand = `${TargetManager.viewId}.focus`;
    public static readonly statusPriority = 100;

    private statusBarItem: vscode.StatusBarItem | undefined;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly targetTreeDataProvider: TargetTreeDataProvider,
        private readonly targetStore: TargetStore,
        private readonly containersManager: ContainersManager,
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
        await this.refreshTargetState();

        this.context.subscriptions.push(
            this.statusBarItem,
            treeView,
            vscode.commands.registerCommand(refreshTargetStateCommand, () =>
                this.refreshTargetState(),
            ),
            vscode.commands.registerCommand(
                refreshTargetContainersCommand,
                () => this.refreshTargetContainers(),
            ),
            vscode.commands.registerCommand(
                TargetManager.addTargetCommand,
                () => this.addTarget(),
            ),
            this.targetStore.onChanged(() => this.refreshTargetState()),
        );
    }

    private async addTarget(): Promise<void> {
        const target = await this.promptForSshTarget();
        if (!target) {
            return;
        }

        try {
            await this.targetStore.addTarget(target);
        } catch (error) {
            const errorMsg = `Failed to add target`;
            logger.warn(errorMsg, error);
            vscode.window.showWarningMessage(errorMsg);
            return;
        }
        await this.targetStore.setSelected(target);
        vscode.commands.executeCommand(refreshTargetStateCommand);
    }

    private async promptForSshTarget(): Promise<string | undefined> {
        const sshHosts = await getHosts(defaultSshConfigPath);
        const existingTargets = new Set(this.targetStore.getTargets());
        const availableHosts = sshHosts.filter(
            (host) => !existingTargets.has(host),
        );

        const quickPick = vscode.window.createQuickPick();
        quickPick.title = 'Add new target';
        quickPick.placeholder =
            'Select a host or type a connection string (e.g. root@192.168.1.1)';
        quickPick.items = buildQuickPickItems(availableHosts, '');

        quickPick.onDidChangeValue((value) => {
            quickPick.items = buildQuickPickItems(availableHosts, value);
        });

        return new Promise<string | undefined>((resolve) => {
            quickPick.onDidAccept(async () => {
                const selected = quickPick.selectedItems[0]?.label?.trim();
                quickPick.hide();
                resolve(selected);
            });

            quickPick.onDidHide(() => {
                resolve(undefined);
            });

            quickPick.show();
        }).finally(() => quickPick.dispose());
    }

    protected async updateStatusBar(target: string | undefined): Promise<void> {
        if (!this.statusBarItem) {
            return;
        }

        if (target) {
            this.statusBarItem.tooltip = `Connection String: ${target}`;
            this.statusBarItem.text = getStatusBarItemText(
                target,
                'disconnected',
            );
            this.statusBarItem.show();
            const targetState =
                await this.containersManager.getTargetState(target);
            this.statusBarItem.text = getStatusBarItemText(
                target,
                targetState.status,
            );
        } else {
            this.statusBarItem.hide();
        }
    }

    private async refreshVisualisations(): Promise<void> {
        const selectedTarget = await this.targetStore.getSelectedTarget();
        this.updateStatusBar(selectedTarget);
        this.targetTreeDataProvider.refresh();
    }

    private async refreshTargetState(): Promise<void> {
        this.containersManager.clear();
        this.refreshVisualisations();
    }

    private async refreshTargetContainers(): Promise<void> {
        this.containersManager.clearContainers();
        this.refreshVisualisations();
    }
}
