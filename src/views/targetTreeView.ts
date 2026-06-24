import * as vscode from 'vscode';
import { ContainerTreeItem } from '../treeItems/containerTreeItem';
import * as manifest from '../manifest';
import { ProcessingDomainTreeItem } from '../treeItems/processingDomainTreeItem';
import { HealthCheckDependencyGroupTreeItem } from '../treeItems/healthCheckDependencyGroupTreeItem';
import { ProcessingDomainGroupTreeItem } from '../treeItems/processingDomainGroupTreeItem';
import { HealthCheckDependencyTreeItem } from '../treeItems/healthCheckDependencyTreeItem';
import { TargetModel } from '../models/targetModel';
import { DisposableCollector } from '../util/disposableCollector';
import { ContainerItem, TargetDescription } from '../util/types';
import { Loadable, loaded } from '../util/loadable';
import { TargetDataIssueTreeItem } from '../targetTreeView/targetDataIssueTreeItem';
import { ErrorTreeItem } from '../treeItems/errorTreeItem';
import { TargetHealthCheck } from '../topoCliSchema';
import { getVisibleTargetIssues } from '../target/getVisibleTargetIssues';
import { LoadingTreeItem } from '../treeItems/loadingTreeItem';

function compareByName(a: { name: string }, b: { name: string }): number {
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

function compareContainers(a: ContainerItem, b: ContainerItem): number {
    if (a.state === 'running' && b.state !== 'running') {
        return -1;
    }
    if (a.state !== 'running' && b.state === 'running') {
        return 1;
    }
    return compareByName(a, b);
}

function filterContainersForProcessingDomain(
    containers: ContainerItem[],
    processingDomainId: string,
): ContainerItem[] {
    return containers.filter((item) => {
        if (processingDomainId === 'PrimaryOS') {
            return item.runtime === manifest.TARGET_HOST_RUNTIME;
        }

        return (
            item.runtime === manifest.TARGET_REMOTEPROC_RUNTIME &&
            item.annotations?.['remoteproc.name'] === processingDomainId
        );
    });
}

const PRIMARY_OS_PROCESSING_DOMAIN = {
    id: 'PrimaryOS',
    label: 'Primary OS',
};

function getSelectedTargetChildren(
    target: string,
    health: Loadable<TargetHealthCheck>,
    targetDescription: Loadable<TargetDescription>,
    selectedTargetContainers: Loadable<ContainerItem[]>,
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
                    new HealthCheckDependencyTreeItem(
                        loaded(health.data.connectivity, health.loading),
                    ),
                ];
            }

            const description =
                targetDescription.status === 'loaded'
                    ? targetDescription.data
                    : undefined;
            const dependenciesGroup = new HealthCheckDependencyGroupTreeItem(
                loaded(
                    getVisibleTargetIssues(health.data, description),
                    health.loading,
                ),
            );
            const subsystemsGroup = new ProcessingDomainGroupTreeItem(
                target,
                description?.remoteProcessors.map((rp) => rp.name) ?? [],
                selectedTargetContainers,
            );
            return [dependenciesGroup, subsystemsGroup];
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

function syncSelectedTargetContext(selectedTarget: string | undefined): void {
    void vscode.commands.executeCommand(
        'setContext',
        manifest.CONTEXT_SELECTED_TARGET,
        selectedTarget ?? '',
    );
}

function refreshHeader(
    treeView: vscode.TreeView<vscode.TreeItem>,
    targetModel: TargetModel,
): void {
    treeView.description = targetModel.selected;
    syncSelectedTargetContext(targetModel.selected);
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
                this.refreshTreeView();
            }),
            this.targetModel.onHealthChanged(() => {
                this.refreshTreeView();
            }),
            this.targetModel.onContainersChanged(() => {
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
                selectedTarget,
                this.targetModel.selectedTargetHealth,
                this.targetModel.selectedTargetDescription,
                this.targetModel.selectedTargetContainers,
            );
        }

        if (element instanceof HealthCheckDependencyGroupTreeItem) {
            const deps = [...element.dependencies].sort(compareByName);
            return deps.map(
                (d) => new HealthCheckDependencyTreeItem(loaded(d)),
            );
        }

        if (element instanceof ProcessingDomainGroupTreeItem) {
            if (element.containers.status === 'errored') {
                return [
                    new ErrorTreeItem(
                        'Failed to load containers',
                        element.containers,
                    ),
                ];
            }

            if (element.containers.status === 'unloaded') {
                return [];
            }

            const sortedContainers = [...element.containers.data].sort(
                compareContainers,
            );

            const processingDomains = [
                PRIMARY_OS_PROCESSING_DOMAIN,
                ...element.remoteProcessorNames.map((name) => ({
                    id: name,
                    label: name,
                })),
            ];
            return processingDomains.map((domain) => {
                const containers = filterContainersForProcessingDomain(
                    sortedContainers,
                    domain.id,
                );

                return new ProcessingDomainTreeItem(
                    domain.id,
                    element.target,
                    containers,
                    domain.label,
                );
            });
        }

        if (element instanceof ProcessingDomainTreeItem) {
            return element.containers.map(
                (container) => new ContainerTreeItem(container),
            );
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
