import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TargetTreeDataProvider } from './targetTreeDataProvider';
import * as manifest from '../manifest';
import { Target } from './target';
import { TargetStore } from './targetStore';
import { logger } from '../util/logger';
import { ContainersManager } from './containersManager';
import { getTreeItemIcon } from './targetTreeTargetItem';
import type { TopoCli } from '../topoCli';
import { isTargetReady } from '../util/targetState';
import { TargetItem } from '../util/types';

export class TargetManager {
    public static readonly viewId = `${manifest.PACKAGE_NAME}.target-manager`;
    public static readonly refreshCommand = `${manifest.PACKAGE_NAME}.refresh`;
    public static readonly addTargetCommand = `${manifest.PACKAGE_NAME}.addTarget`;
    public static readonly FocusViewCommand = `${TargetManager.viewId}.focus`;
    public static readonly statusPriority = 100;

    private statusBarItem: vscode.StatusBarItem | undefined;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly targetTreeDataProvider: TargetTreeDataProvider,
        private readonly targetStore: TargetStore,
        private readonly containersManager: ContainersManager,
        private readonly topoCli: TopoCli,
    ) {}

    private async getTargetDescription(
        ssh: string,
    ): Promise<string | undefined> {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'topo-target-'));
        try {
            const descriptionPath = await this.topoCli.describe(tmpDir, ssh);
            return fs.readFileSync(descriptionPath, 'utf8');
        } catch (error) {
            logger.warn(`Failed to get target description for ${ssh}`, error);
            return undefined;
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    }

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
        const ssh = await vscode.window.showInputBox({
            title: 'Enter a connection string for the target',
            placeHolder: 'root@192.168.1.1',
        });
        if (!ssh?.trim()) {
            return;
        }

        const id = await vscode.window.showInputBox({
            title: 'Enter a unique id for the target',
            placeHolder: 'target-id',
            value: ssh,
        });
        if (!id?.trim()) {
            return;
        }

        const targetDescription = await this.getTargetDescription(ssh);
        if (targetDescription === undefined) {
            const errorMsg = `Failed to get target description for ${ssh}`;
            logger.warn(errorMsg);
        }

        const newTarget = new Target(id, ssh, targetDescription);

        try {
            await this.targetStore.addTarget(newTarget);
        } catch (error) {
            const errorMsg = `Failed to add target`;
            logger.warn(errorMsg, error);
            vscode.window.showWarningMessage(errorMsg);
            return;
        }
        await this.targetStore.setSelected(newTarget.id);
    }

    protected async updateStatusBar(
        selectedTarget: TargetItem | undefined,
    ): Promise<void> {
        if (!this.statusBarItem) {
            return;
        }
        if (selectedTarget) {
            const targetState = await this.containersManager.getTargetState();
            const connectionReady = selectedTarget.id === targetState.targetId;
            const targetTreeIcon = getTreeItemIcon(
                true,
                connectionReady,
                isTargetReady(targetState),
            );
            const iconId = targetTreeIcon?.id || 'pass-filled';
            this.statusBarItem.text = `$(${iconId}) ${selectedTarget.id}`;
            this.statusBarItem.tooltip = `Connection String: ${selectedTarget.ssh}`;
            this.statusBarItem.show();
        } else {
            this.statusBarItem.hide();
        }
    }

    private async updateTargetDescription(
        selectedTarget: TargetItem | undefined,
    ): Promise<void> {
        if (!selectedTarget || selectedTarget.targetDescription !== undefined) {
            return;
        }

        const targetState = await this.containersManager.getTargetState();
        if (!isTargetReady(targetState)) {
            return;
        }

        const targetDescription = await this.getTargetDescription(
            selectedTarget.ssh,
        );
        if (targetDescription === undefined) {
            return;
        }

        const updatedTarget = new Target(
            selectedTarget.id,
            selectedTarget.ssh,
            targetDescription,
        );

        await this.targetStore.updateTarget(updatedTarget);
    }

    private async refreshTargetVisualisation(): Promise<void> {
        const selectedTarget = await this.targetStore.getSelectedTarget();
        try {
            await this.updateStatusBar(selectedTarget);
        } catch (error) {
            logger.error(`Failed to update target manager status bar`, error);
        }

        try {
            await this.updateTargetDescription(selectedTarget);
        } catch (error) {
            logger.warn(`Failed to update target description`, error);
        }
    }
}
