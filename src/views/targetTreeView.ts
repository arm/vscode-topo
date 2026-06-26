import * as vscode from 'vscode';
import * as manifest from '../manifest';
import { HealthCheckGroupTreeItem } from './treeItems/healthCheckGroupTreeItem';
import { HealthCheckTreeItem } from './treeItems/healthCheckTreeItem';
import { TargetModel } from '../models/targetModel';
import { DisposableCollector } from '../util/disposableCollector';
import { TargetDescription } from '../util/types';
import { Loadable, loaded } from '../util/loadable';
import { TargetDataIssueTreeItem } from './treeItems/targetDataIssueTreeItem';
import { ErrorTreeItem } from './treeItems/errorTreeItem';
import { TargetHealthReport } from '../topoCliSchema';
import { getVisibleTargetHealthChecks } from '../target/getVisibleTargetHealthChecks';
import { LoadingTreeItem } from './treeItems/loadingTreeItem';
import {
    compareProcessingDomains,
    ProcessingDomainTreeItem,
} from './treeItems/processingDomainTreeItem';
import { ProcessingDomainGroupTreeItem } from './treeItems/processingDomainGroupTreeItem';

export const TargetSelectionState = {
    Unselected: 'unselected',
    Selected: 'selected',
} as const;

function compareByName(a: { name: string }, b: { name: string }): number {
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

function getProcessingDomainGroupChildren(
    targetDescription: Loadable<TargetDescription>,
): vscode.TreeItem[] {
    if (targetDescription.status === 'errored') {
        return [
            new ErrorTreeItem(
                'Failed to load processing domains',
                targetDescription,
            ),
        ];
    }

    if (targetDescription.status === 'unloaded') {
        return [];
    }

    const processingDomains = [
        manifest.PRIMARY_PROCESSING_DOMAIN,
        ...targetDescription.data.remoteProcessors.map(
            (remoteProcessor) => remoteProcessor.name,
        ),
    ];

    return processingDomains
        .map((processingDomain) => {
            return new ProcessingDomainTreeItem(processingDomain);
        })
        .sort(compareProcessingDomains);
}

function getSelectedTargetChildren(
    health: Loadable<TargetHealthReport>,
    targetDescription: Loadable<TargetDescription>,
): vscode.TreeItem[] {
    switch (health.status) {
        case 'unloaded':
            return health.loading
                ? [new LoadingTreeItem('Checking target health')]
                : [];
        case 'errored':
            return [new ErrorTreeItem('Failed to check target health', health)];
        case 'loaded': {
            if (health.data.connectivity.status !== 'ok') {
                return [
                    new HealthCheckTreeItem(
                        loaded(health.data.connectivity, health.loading),
                    ),
                ];
            }

            const description =
                targetDescription.status === 'loaded'
                    ? targetDescription.data
                    : undefined;
            const healthGroup = new HealthCheckGroupTreeItem(
                loaded(
                    getVisibleTargetHealthChecks(health.data, description),
                    health.loading,
                ),
            );
            const processingDomainGroup = new ProcessingDomainGroupTreeItem(
                targetDescription,
            );
            return [healthGroup, processingDomainGroup];
        }
    }
}

function syncTargetDataIssueContext(targets: Loadable<string[]>): void {
    void vscode.commands.executeCommand(
        'setContext',
        manifest.CONTEXT_TARGET_DATA_ISSUE,
        targets.status === 'errored',
    );
}

function syncSelectedTargetContext(targetModel: TargetModel): void {
    const state = targetModel.selected
        ? TargetSelectionState.Selected
        : TargetSelectionState.Unselected;
    void vscode.commands.executeCommand(
        'setContext',
        manifest.CONTEXT_SELECTED_TARGET_STATE,
        state,
    );
}

function refreshHeader(
    treeView: vscode.TreeView<vscode.TreeItem>,
    targetModel: TargetModel,
): void {
    treeView.description = targetModel.selected;
    syncSelectedTargetContext(targetModel);
}

export class TargetTreeView
    implements vscode.TreeDataProvider<vscode.TreeItem>, vscode.Disposable
{
    public static readonly viewId = `${manifest.PACKAGE_NAME}.target-manager`;
    public static readonly focusViewCommand = `${TargetTreeView.viewId}.focus`;

    private _onDidChangeTreeData = new vscode.EventEmitter<undefined>();
    public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private readonly disposables = new DisposableCollector();

    constructor(private readonly targetModel: TargetModel) {
        const treeView = vscode.window.createTreeView(TargetTreeView.viewId, {
            treeDataProvider: this,
            showCollapseAll: true,
        });
        refreshHeader(treeView, this.targetModel);

        this.disposables.collect(
            treeView,
            this.targetModel.onSelectedChanged(() => {
                refreshHeader(treeView, this.targetModel);
                this.refreshTreeView();
            }),
            this.targetModel.onTargetsChanged(() => {
                syncTargetDataIssueContext(this.targetModel.targets);
                if (!this.targetModel.selected) {
                    syncSelectedTargetContext(this.targetModel);
                }
                this.refreshTreeView();
            }),
            this.targetModel.onHealthChanged(() => {
                this.refreshTreeView();
            }),
            this.targetModel.onDescriptionChanged(() => {
                this.refreshTreeView();
            }),
            this._onDidChangeTreeData,
        );
        syncTargetDataIssueContext(this.targetModel.targets);
    }

    public getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
        if (!element) {
            if (this.targetModel.targets.status === 'errored') {
                return [new TargetDataIssueTreeItem(this.targetModel.targets)];
            }

            const selectedTarget = this.targetModel.selected;
            if (!selectedTarget) {
                return [];
            }

            return getSelectedTargetChildren(
                this.targetModel.selectedTargetHealth,
                this.targetModel.selectedTargetDescription,
            );
        }

        if (element instanceof HealthCheckGroupTreeItem) {
            const healthChecks = [...element.healthChecks].sort(compareByName);
            return healthChecks.map(
                (healthCheck) => new HealthCheckTreeItem(loaded(healthCheck)),
            );
        }

        if (element instanceof ProcessingDomainGroupTreeItem) {
            return getProcessingDomainGroupChildren(element.targetDescription);
        }

        return [];
    }

    public getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    private refreshTreeView(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    public dispose(): void {
        this.disposables.dispose();
    }
}
