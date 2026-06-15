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
import { ContainerItem } from '../util/types';
import { loaded } from '../util/loadable';
import { TargetDataIssueTreeItem } from '../targetTreeView/targetDataIssueTreeItem';
import { ErrorTreeItem } from '../treeItems/errorTreeItem';
import debounce from 'lodash.debounce';

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
const targetDataIssueContextKey = `${manifest.PACKAGE_NAME}.targetDataIssue`;
const refreshDelayMs = 500;

export class TargetTreeView
    implements vscode.TreeDataProvider<vscode.TreeItem>, vscode.Disposable
{
    public static readonly viewId = `${manifest.PACKAGE_NAME}.target-manager`;
    public static readonly focusViewCommand = `${TargetTreeView.viewId}.focus`;

    private _onDidChangeTreeData = new vscode.EventEmitter<undefined>();
    public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private readonly disposables = new DisposableCollector();

    constructor(
        private readonly targetModel: TargetModel,
        private readonly targetDescriptionStore: TargetDescriptionStore,
    ) {
        const treeView = vscode.window.createTreeView(TargetTreeView.viewId, {
            treeDataProvider: this,
            showCollapseAll: false,
        });

        this.disposables.collect(
            treeView,
            this.targetModel.onSelectedChanged(() => {
                this.refresh();
            }),
            this.targetModel.onTargetsChanged(() => {
                this.refresh();
            }),
            this.targetModel.onHealthChanged(() => {
                this.refresh();
            }),
            this.targetModel.onContainersChanged(() => {
                this.refresh();
            }),
            this._onDidChangeTreeData,
            { dispose: () => this.refresh.cancel() },
        );
        this.syncTargetDataIssueContext();
    }

    public async getChildren(
        element?: vscode.TreeItem,
    ): Promise<vscode.TreeItem[]> {
        if (!element) {
            if (this.targetModel.targets.status === 'errored') {
                return [new TargetDataIssueTreeItem(this.targetModel.targets)];
            }

            const selectedTarget = this.targetModel.selected;
            if (!selectedTarget) {
                return [];
            }

            const selectedTargetDescription =
                await this.targetDescriptionStore.getDescription(
                    selectedTarget,
                );

            return [
                new TargetTreeItem({
                    target: selectedTarget,
                    health: this.targetModel.selectedTargetHealth,
                    targetDescription: selectedTargetDescription
                        ? loaded(selectedTargetDescription)
                        : undefined,
                }),
            ];
        }

        if (element instanceof TargetTreeItem) {
            if (!element.connected) {
                return [];
            }

            const dependenciesGroup = new HealthCheckDependencyGroupTreeItem(
                loaded(element.visibleIssues, element.health.loading),
            );
            const subsystemsGroup = new TargetProcessingDomainGroupTreeItem(
                element.target,
                element.remoteProcessorNames,
                this.targetModel.selectedTargetContainers,
            );
            return [dependenciesGroup, subsystemsGroup];
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

    private refresh = debounce(() => {
        this._onDidChangeTreeData.fire(undefined);
        this.syncTargetDataIssueContext();
    }, refreshDelayMs);

    private syncTargetDataIssueContext(): void {
        vscode.commands.executeCommand(
            'setContext',
            targetDataIssueContextKey,
            this.targetModel.targets.status === 'errored',
        );
    }

    public dispose(): void {
        this.disposables.dispose();
    }
}
