import * as vscode from 'vscode';
import { TargetTreeDataProvider } from './targetTreeDataProvider';
import * as manifest from '../manifest';
import { Target } from './target';
import { TargetStore } from './targetStore';
import { logger } from '../util/logger';
import { ContainersManager } from './containersManager';
import { getTreeItemIcon } from './targetTreeBoardItem';

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
        private readonly targetStore: Pick<
            TargetStore,
            'addTarget' | 'setSelected' | 'getSelectedTarget' | 'onChanged'
        >,
        private readonly containersManager: Pick<
            ContainersManager,
            'getBoardState' | 'onDataUpdate'
        >,
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
        await this.safeUpdateStatusBar();

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
            this.targetStore.onChanged(() => this.safeUpdateStatusBar()),
            this.containersManager.onDataUpdate(() =>
                this.safeUpdateStatusBar(),
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
            placeHolder: ssh,
        });
        if (!id?.trim()) {
            return;
        }

        const newTarget = new Target(id, ssh);

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

    protected async updateStatusBar(): Promise<void> {
        if (!this.statusBarItem) {
            return;
        }
        const target = await this.targetStore.getSelectedTarget();
        if (target) {
            const boardState = await this.containersManager.getBoardState();
            const connectionReady = target.id === boardState.targetId;
            const targetReady =
                boardState.isReachable && boardState.hasContainerRuntime;
            const targetTreeIcon = getTreeItemIcon(
                true,
                connectionReady,
                targetReady,
            );
            const iconId = targetTreeIcon?.id || 'pass-filled';
            this.statusBarItem.text = `$(${iconId}) ${target.id}`;
            this.statusBarItem.tooltip = `Connection String: ${target.ssh}`;
            this.statusBarItem.show();
        } else {
            this.statusBarItem.hide();
        }
    }

    protected async safeUpdateStatusBar(): Promise<void> {
        try {
            await this.updateStatusBar();
        } catch (error) {
            logger.error(`Failed to update target manager status bar`, error);
        }
    }
}
