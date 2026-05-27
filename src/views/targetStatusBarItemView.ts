import * as vscode from 'vscode';
import { TargetStore } from '../target/targetStore';
import { ContainersManager } from '../target/containersManager';
import { getTargetTreeItemIcon } from '../targetTreeView/targetTreeItem';
import { TargetTreeView } from './targetTreeView';
import { TargetStatus } from '../util/types';

function renderStatusBarItem(
    statusBarItem: vscode.StatusBarItem,
    target: string | undefined,
    status: TargetStatus,
): void {
    if (target) {
        const targetTreeIcon = getTargetTreeItemIcon(true, status);
        const iconId = targetTreeIcon?.id || 'pass-filled';
        statusBarItem.text = `$(${iconId}) ${target}`;
        statusBarItem.tooltip = `Connection String: ${target}`;
        statusBarItem.show();
    } else {
        statusBarItem.hide();
    }
}

export class TargetStatusBarItemView {
    public static readonly priority = 100;
    public static readonly id = 'topo-target-status-bar-item';

    private disposables: vscode.Disposable[] = [];

    private statusBarItem: vscode.StatusBarItem;

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

    private refresh(): void {
        const selectedTarget = this.targetStore.getSelectedTarget();
        const status = selectedTarget
            ? this.containersManager.getTargetStateSnapshot(selectedTarget)
                  .status
            : 'disconnected';
        renderStatusBarItem(this.statusBarItem, selectedTarget, status);
    }

    public dispose(): void {
        for (const disposable of [...this.disposables].reverse()) {
            disposable.dispose();
        }
        this.disposables = [];
    }
}
