import * as vscode from 'vscode';
import { TargetStore } from '../target/targetStore';
import { ContainersManager } from '../target/containersManager';
import { getTargetTreeItemIcon } from '../targetTreeView/targetTreeItem';
import { TargetTreeView } from './targetTreeView';

export class TargetStatusBarItemView {
    public static readonly priority = 100;
    public static readonly id = 'topo-target-status-bar-item';

    private disposables: vscode.Disposable[] = [];

    private statusBarItem: vscode.StatusBarItem | undefined;

    constructor(
        private readonly targetStore: TargetStore,
        private readonly containersManager: ContainersManager,
    ) {
        this.statusBarItem = vscode.window.createStatusBarItem(
            TargetStatusBarItemView.id,
            vscode.StatusBarAlignment.Left,
            TargetStatusBarItemView.priority,
        );
        this.statusBarItem.command = TargetTreeView.focusViewCommand;
        this.refresh();

        this.disposables.push(
            this.statusBarItem,
            this.targetStore.onChanged(() => this.refresh()),
            this.containersManager.onDataUpdate(() => this.refresh()),
        );
    }

    protected renderStatusBarItem(selectedTarget: string | undefined): void {
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

    private refresh(): void {
        const selectedTarget = this.targetStore.getSelectedTarget();
        this.renderStatusBarItem(selectedTarget);
    }

    public dispose(): void {
        for (const disposable of [...this.disposables].reverse()) {
            disposable.dispose();
        }
        this.disposables = [];
    }
}
