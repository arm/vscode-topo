import * as vscode from 'vscode';
import { ContainersManager } from '../target/containersManager';
import { getTargetTreeItemIcon } from '../targetTreeView/targetTreeItem';
import { TargetTreeView } from './targetTreeView';
import { TargetState } from '../util/types';
import { TargetModel } from '../models/targetModel';
import { DisposableCollector } from '../util/disposableCollector';
import { getWorstIssueCheckStatus } from '../util/getWorstIssueCheckStatus';
import { getDependencyGroupIcon } from './util/dependencyIcons';

function getStatusIconId(state: TargetState): string {
    const targetTreeIcon = getTargetTreeItemIcon(true, state.status);
    if (targetTreeIcon) {
        return targetTreeIcon.id;
    }

    const status = getWorstIssueCheckStatus(state.health?.dependencies ?? []);
    if (status === 'ok') {
        return 'pass-filled';
    }

    return getDependencyGroupIcon(status).id;
}

function renderStatusBarItem(
    statusBarItem: vscode.StatusBarItem,
    target: string | undefined,
    state: TargetState,
): void {
    if (target) {
        const iconId = getStatusIconId(state);
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
        const state: TargetState = selectedTarget
            ? this.containersManager.getTargetStateSnapshot(selectedTarget)
            : { health: undefined, status: 'disconnected' };
        renderStatusBarItem(this.statusBarItem, selectedTarget, state);
    }

    public dispose(): void {
        this.disposables.dispose();
    }
}
