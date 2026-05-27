import * as vscode from 'vscode';
import { TargetTreeDataProvider } from './targetTreeDataProvider';
import * as manifest from '../manifest';
import { TargetStore } from '../target/targetStore';
import { ContainersManager } from '../target/containersManager';
import { getTargetTreeItemIcon } from './targetTreeItem';

export class TargetManager {
    public static readonly viewId = `${manifest.PACKAGE_NAME}.target-manager`;
    public static readonly refreshCommand = `${manifest.PACKAGE_NAME}.refresh`;
    public static readonly FocusViewCommand = `${TargetManager.viewId}.focus`;
    public static readonly statusPriority = 100;

    private statusBarItem: vscode.StatusBarItem | undefined;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly targetTreeDataProvider: TargetTreeDataProvider,
        private readonly targetStore: TargetStore,
        private readonly containersManager: ContainersManager,
    ) {}

    public activate() {
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
        this.refreshTargetVisualisation();

        this.context.subscriptions.push(
            this.statusBarItem,
            treeView,
            vscode.commands.registerCommand(TargetManager.refreshCommand, () =>
                this.targetTreeDataProvider.refresh(),
            ),
            this.targetStore.onChanged(() => this.refreshTargetVisualisation()),
            this.containersManager.onDataUpdate(() =>
                this.refreshTargetVisualisation(),
            ),
        );
    }

    protected updateStatusBar(selectedTarget: string | undefined): void {
        if (!this.statusBarItem) {
            return;
        }
        if (selectedTarget) {
            const targetState =
                this.containersManager.getTargetStateSnapshot(selectedTarget);
            const targetTreeIcon = getTargetTreeItemIcon(
                true,
                targetState.status,
            );
            const iconId = targetTreeIcon?.id || 'pass-filled';
            this.statusBarItem.text = `$(${iconId}) ${selectedTarget}`;
            this.statusBarItem.tooltip = `Connection String: ${selectedTarget}`;
            this.statusBarItem.show();
        } else {
            this.statusBarItem.hide();
        }
    }

    private refreshTargetVisualisation(): void {
        const selectedTarget = this.targetStore.getSelectedTarget();
        this.updateStatusBar(selectedTarget);
    }
}
