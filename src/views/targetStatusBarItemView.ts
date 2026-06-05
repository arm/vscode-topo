import * as vscode from 'vscode';
import { getTargetTreeItemIcon } from '../targetTreeView/targetTreeItem';
import { TargetTreeView } from './targetTreeView';
import { TargetModel } from '../models/targetModel';
import { DisposableCollector } from '../util/disposableCollector';
import { getWorstDependencyStatus } from '../util/getWorstDependencyStatus';
import { getDependencyGroupIcon } from './util/dependencyIcons';
import { SelectedTargetModel } from '../models/selectedTargetModel';
import { Loadable } from '../util/loadable';
import { TargetHealthCheckResult } from '../topoCliSchema';

function getStatusIconId(
    state: Loadable<TargetHealthCheckResult | undefined>,
): string {
    const targetTreeIcon = getTargetTreeItemIcon(true, state);
    if (targetTreeIcon) {
        return targetTreeIcon.id;
    }

    const deps =
        state.status === 'loaded' && state.data ? state.data.dependencies : [];
    const status = getWorstDependencyStatus(deps);
    if (status === 'ok') {
        return 'pass-filled';
    }

    return getDependencyGroupIcon(status).id;
}

function renderStatusBarItem(
    statusBarItem: vscode.StatusBarItem,
    target: string | undefined,
    selectedHealth: Loadable<TargetHealthCheckResult | undefined>,
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

    constructor(
        private readonly targetModel: TargetModel,
        private readonly selectedTargetModel: SelectedTargetModel,
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
            this.selectedTargetModel.onHealthChanged(() => this.refresh()),
        );
    }

    private refresh(): void {
        const selectedTarget = this.targetModel.selected;
        const selectedHealth = this.selectedTargetModel.health;
        renderStatusBarItem(this.statusBarItem, selectedTarget, selectedHealth);
    }

    public dispose(): void {
        this.disposables.dispose();
    }
}
