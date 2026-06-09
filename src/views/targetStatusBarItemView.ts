import * as vscode from 'vscode';
import { getTargetTreeItemIcon } from '../targetTreeView/targetTreeItem';
import { TargetTreeView } from './targetTreeView';
import { TargetModel } from '../models/targetModel';
import { DisposableCollector } from '../util/disposableCollector';
import { getWorstIssueCheckStatus } from '../util/getWorstIssueCheckStatus';
import { getDependencyGroupIcon } from './util/dependencyIcons';
import { Loadable } from '../util/loadable';
import { TargetHealthCheck } from '../topoCliSchema';

function getStatusIconId(
    state: Loadable<TargetHealthCheck | undefined>,
): string {
    const targetTreeIcon = getTargetTreeItemIcon(true, state);
    if (targetTreeIcon) {
        return targetTreeIcon.id;
    }

    const dependencies =
        state.status === 'loaded' && state.data ? state.data.dependencies : [];
    const status = getWorstIssueCheckStatus(dependencies);
    if (status === 'ok') {
        return 'pass-filled';
    }

    return getDependencyGroupIcon(status).id;
}

function renderStatusBarItem(
    statusBarItem: vscode.StatusBarItem,
    target: string | undefined,
    selectedHealth: Loadable<TargetHealthCheck | undefined>,
): void {
    if (target) {
        const iconId = getStatusIconId(selectedHealth);
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

    constructor(private readonly targetModel: TargetModel) {
        this.statusBarItem = vscode.window.createStatusBarItem(
            TargetStatusBarItemView.id,
            vscode.StatusBarAlignment.Left,
            TargetStatusBarItemView.priority,
        );
        this.statusBarItem.command = TargetTreeView.focusViewCommand;
        this.refresh();

        this.disposables.collect(
            this.statusBarItem,
            this.targetModel.onHealthChanged(() => this.refresh()),
        );
    }

    private refresh(): void {
        const selectedTarget = this.targetModel.selected;
        const selectedHealth = this.targetModel.selectedTargetHealth;
        renderStatusBarItem(this.statusBarItem, selectedTarget, selectedHealth);
    }

    public dispose(): void {
        this.disposables.dispose();
    }
}
