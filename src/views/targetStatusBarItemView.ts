import * as vscode from 'vscode';
import { TargetTreeView } from './targetTreeView';
import { TargetModel } from '../models/targetModel';
import { DisposableCollector } from '../util/disposableCollector';
import { getWorstHealthCheckStatus } from '../util/getWorstHealthCheckStatus';
import { getHealthCheckIcon } from './util/healthIcons';
import { Loadable } from '../util/loadable';
import { TargetHealthReport } from '../services/topoCliSchema';
import { selectTarget } from '../commands';
import { getErrorMessage } from '../util/getErrorMessage';

function getStatusIconId(state: Loadable<TargetHealthReport>): string {
    if (state.loading) {
        return 'loading~spin';
    }

    if (
        state.status === 'errored' ||
        (state.status === 'loaded' && state.data.connectivity.status !== 'ok')
    ) {
        return 'error';
    }

    if (state.status !== 'loaded') {
        return 'target';
    }

    const status = getWorstHealthCheckStatus(state.data.dependencies);
    if (status === 'ok') {
        return 'pass-filled';
    }

    return getHealthCheckIcon(status).id;
}

function getStatusTooltip(
    target: string,
    selectedHealth: Loadable<TargetHealthReport>,
): string {
    const lines = [`SSH destination: ${target}`];

    if (selectedHealth.status === 'errored') {
        lines.push(`Target health: ${getErrorMessage(selectedHealth.error)}`);
        return lines.join('\n');
    }

    if (selectedHealth.status !== 'loaded') {
        return lines.join('\n');
    }

    if (selectedHealth.data.connectivity.status !== 'ok') {
        const { name, value } = selectedHealth.data.connectivity;
        lines.push(`${name}: ${value}`);
    }

    const dependencyIssues = selectedHealth.data.dependencies.filter(
        ({ status }) => status === 'warning' || status === 'error',
    );
    lines.push(
        ...dependencyIssues.map(({ name, value }) => `${name}: ${value}`),
    );
    return lines.join('\n');
}

function renderStatusBarItem(
    statusBarItem: vscode.StatusBarItem,
    target: string | undefined,
    selectedHealth: Loadable<TargetHealthReport>,
): void {
    if (target) {
        const iconId = getStatusIconId(selectedHealth);
        statusBarItem.text = `$(${iconId}) ${target}`;
        statusBarItem.tooltip = getStatusTooltip(target, selectedHealth);
        statusBarItem.command = TargetTreeView.focusViewCommand;
        statusBarItem.show();
    } else {
        statusBarItem.text = '$(target) Select a target';
        statusBarItem.tooltip = 'Select a target';
        statusBarItem.command = selectTarget;
        statusBarItem.show();
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
        this.refresh();

        this.disposables.collect(
            this.statusBarItem,
            this.targetModel.onSelectedChanged(() => this.refresh()),
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
