import * as vscode from 'vscode';
import { ContainersManager } from '../target/containersManager';
import { getTargetTreeItemIcon } from '../targetTreeView/targetTreeItem';
import { TargetTreeView } from './targetTreeView';
import { TargetStatus } from '../util/types';
import { TargetModel } from '../models/targetModel';
import { DisposableCollector } from '../util/disposableCollector';

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

export class TargetStatusBarItemView implements vscode.Disposable {
    public static readonly priority = 100;
    public static readonly id = 'topo-target-status-bar-item';

    private readonly disposables = new DisposableCollector();

    private statusBarItem: vscode.StatusBarItem;

    constructor(
        private readonly targetModel: TargetModel,
        private readonly containersManager: ContainersManager,
    ) {
        this.statusBarItem = vscode.window.createStatusBarItem(
            TargetStatusBarItemView.id,
            vscode.StatusBarAlignment.Left,
            TargetStatusBarItemView.priority,
        );
        this.statusBarItem.command = TargetTreeView.focusViewCommand;
        this.refresh();

        this.disposables.collect(
            this.statusBarItem,
            this.targetModel.onSelectedChanged(() => this.refresh()),
            this.containersManager.onDataUpdate(() => this.refresh()),
        );
    }

    private refresh(): void {
        const selectedTarget = this.targetModel.selected;
        const status = selectedTarget
            ? this.containersManager.getTargetStateSnapshot(selectedTarget)
                  .status
            : 'disconnected';
        renderStatusBarItem(this.statusBarItem, selectedTarget, status);
    }

    public dispose(): void {
        this.disposables.dispose();
    }
}
