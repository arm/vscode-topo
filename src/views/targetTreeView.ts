import * as vscode from 'vscode';
import { TargetContainerTreeItem } from '../targetTreeView/targetContainerTreeItem';
import * as manifest from '../manifest';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import { TargetProcessingDomainTreeItem } from '../targetTreeView/targetProcessingDomainTreeItem';
import { HealthCheckDependencyGroupTreeItem } from '../treeItems/healthCheckDependencyGroupTreeItem';
import { TargetProcessingDomainGroupTreeItem } from '../targetTreeView/targetProcessingDomainGroupTreeItem';
import { HealthCheckDependencyTreeItem } from '../treeItems/healthCheckDependencyTreeItem';
import { TargetDescriptionStore } from '../target/targetDescriptionStore';
import { TargetModel } from '../models/targetModel';
import { DisposableCollector } from '../util/disposableCollector';
import { ContainerItem, TargetDescription } from '../util/types';
import { Loadable, loaded } from '../util/loadable';
import { ErrorTreeItem } from '../treeItems/errorTreeItem';
import { IssueCheck, TargetHealthCheck } from '../topoCliSchema';

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

function getConnectivityIssue(
    health: Loadable<TargetHealthCheck | undefined>,
): IssueCheck | undefined {
    if (health.status === 'errored') {
        return {
            name: 'Connectivity',
            status: 'error',
            value: health.error.message,
        };
    }

    if (health.status !== 'loaded') {
        return undefined;
    }

    const healthData = health.data;
    if (healthData === undefined) {
        return {
            name: 'Connectivity',
            status: 'warning',
            value: 'Checking target connectivity',
        };
    }

    if (healthData.connectivity.status !== 'ok') {
        return healthData.connectivity;
    }

    return undefined;
}

export class TargetTreeView
    implements vscode.TreeDataProvider<vscode.TreeItem>, vscode.Disposable
{
    public static readonly viewId = `${manifest.PACKAGE_NAME}.target-manager`;
    public static readonly focusViewCommand = `${TargetTreeView.viewId}.focus`;

    private _onDidChangeTreeData = new vscode.EventEmitter<undefined>();
    public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private readonly disposables = new DisposableCollector();
    private readonly treeView: vscode.TreeView<vscode.TreeItem>;

    constructor(
        private readonly targetModel: TargetModel,
        private readonly targetDescriptionStore: TargetDescriptionStore,
    ) {
        this.treeView = vscode.window.createTreeView(TargetTreeView.viewId, {
            treeDataProvider: this,
            showCollapseAll: true,
        });
        this.refreshHeader();

        this.disposables.collect(
            this.treeView,
            this.targetModel.onSelectedChanged(() => {
                this.refreshHeader();
                this._onDidChangeTreeData.fire(undefined);
            }),
            this.targetModel.onTargetsChanged(() => {
                this._onDidChangeTreeData.fire(undefined);
            }),
            this.targetModel.onHealthChanged(() => {
                this._onDidChangeTreeData.fire(undefined);
            }),
            this.targetModel.onContainersChanged(() => {
                this._onDidChangeTreeData.fire(undefined);
            }),
            this._onDidChangeTreeData,
        );
    }

    private refreshHeader(): void {
        const selectedTarget = this.targetModel.selected;
        this.treeView.description = selectedTarget;
        void vscode.commands.executeCommand(
            'setContext',
            'topo.targetSelected',
            selectedTarget !== undefined,
        );
        void vscode.commands.executeCommand(
            'setContext',
            'topo.targetHasFixableIssues',
            false,
        );
    }

    private getSelectedTargetItem(
        targetDescription?: TargetDescription,
    ): TargetTreeItem | undefined {
        const selectedTarget = this.targetModel.selected;
        if (!selectedTarget) {
            return undefined;
        }

        return new TargetTreeItem({
            target: selectedTarget,
            health: this.targetModel.selectedTargetHealth,
            targetDescription: targetDescription
                ? loaded(targetDescription)
                : undefined,
        });
    }

    private getImmediateTargetChildren(
        targetItem: TargetTreeItem,
    ): vscode.TreeItem[] | undefined {
        void vscode.commands.executeCommand(
            'setContext',
            'topo.targetHasFixableIssues',
            targetItem.fixableIssues.length > 0,
        );

        const connectivityIssue = getConnectivityIssue(targetItem.health);
        if (connectivityIssue) {
            return [
                new HealthCheckDependencyTreeItem(connectivityIssue, {
                    loading:
                        targetItem.health.status === 'loaded' &&
                        targetItem.health.data === undefined,
                }),
            ];
        }

        if (!targetItem.connected) {
            return [];
        }

        return undefined;
    }

    private getSelectedTargetChildren(
        targetItem: TargetTreeItem,
    ): vscode.TreeItem[] {
        const immediateChildren = this.getImmediateTargetChildren(targetItem);
        if (immediateChildren) {
            return immediateChildren;
        }

        const dependenciesGroup = new HealthCheckDependencyGroupTreeItem(
            loaded(targetItem.visibleIssues, targetItem.health.loading),
        );
        const subsystemsGroup = new TargetProcessingDomainGroupTreeItem(
            targetItem.target,
            targetItem.remoteProcessorNames,
            this.targetModel.selectedTargetContainers,
        );
        return [dependenciesGroup, subsystemsGroup];
    }

    public async getChildren(
        element?: vscode.TreeItem,
    ): Promise<vscode.TreeItem[]> {
        if (!element) {
            const targetItem = this.getSelectedTargetItem();
            const immediateChildren = targetItem
                ? this.getImmediateTargetChildren(targetItem)
                : [];
            if (immediateChildren) {
                return immediateChildren;
            }

            const selectedTarget = this.targetModel.selected;
            const selectedTargetDescription = selectedTarget
                ? await this.targetDescriptionStore.getDescription(
                      selectedTarget,
                  )
                : undefined;

            const targetItemWithDescription = this.getSelectedTargetItem(
                selectedTargetDescription,
            );
            return targetItemWithDescription
                ? this.getSelectedTargetChildren(targetItemWithDescription)
                : [];
        }

        if (element instanceof TargetTreeItem) {
            return this.getSelectedTargetChildren(element);
        }

        if (element instanceof HealthCheckDependencyGroupTreeItem) {
            const deps = [...element.dependencies].sort(compareByName);
            return deps.map((d) => new HealthCheckDependencyTreeItem(d));
        }

        if (element instanceof TargetProcessingDomainGroupTreeItem) {
            if (element.containers.status === 'errored') {
                return [
                    new ErrorTreeItem(
                        'Failed to load containers',
                        element.containers,
                    ),
                ];
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

                return new TargetProcessingDomainTreeItem(
                    domain.id,
                    element.target,
                    containers,
                    domain.label,
                );
            });
        }

        if (element instanceof TargetProcessingDomainTreeItem) {
            return element.containers.map(
                (container) => new TargetContainerTreeItem(container),
            );
        }

        return [];
    }

    public getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    public dispose(): void {
        this.disposables.dispose();
    }
}
