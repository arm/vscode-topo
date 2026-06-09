import * as vscode from 'vscode';
import { ContainersManager } from '../target/containersManager';
import { getTargetTreeItemIcon } from '../targetTreeView/targetTreeItem';
import { TargetTreeView } from './targetTreeView';
import { TargetState } from '../util/types';
import { TargetModel } from '../models/targetModel';
import { DisposableCollector } from '../util/disposableCollector';
import { getWorstDependencyStatus } from '../util/getWorstDependencyStatus';
import { getDependencyGroupIcon } from './util/dependencyIcons';
import { errored, Loadable, loaded } from '../util/loadable';
import { TargetHealthCheckResult } from '../topoCliSchema';

function targetHealthLoadable(
    state: TargetState,
): Loadable<TargetHealthCheckResult | undefined> {
    if (state.status === 'connected') {
        return loaded(state.health);
    }
    if (state.status === 'error') {
        return errored('Target health not available');
    }
    return loaded(undefined, true);
}

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
    state: Loadable<TargetHealthCheckResult | undefined>,
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
        const state = selectedTarget
            ? targetHealthLoadable(
                  this.containersManager.getTargetStateSnapshot(selectedTarget),
              )
            : loaded(undefined);
        renderStatusBarItem(this.statusBarItem, selectedTarget, state);
    }

    public dispose(): void {
        this.disposables.dispose();
    }
}
