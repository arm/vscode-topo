import * as vscode from 'vscode';
import { TargetContainerTreeItem } from '../targetTreeView/targetContainerTreeItem';
import * as manifest from '../manifest';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import { TargetSubsystemTreeItem } from '../targetTreeView/targetSubsystemTreeItem';
import { HealthCheckDependencyGroupTreeItem } from '../treeItems/healthCheckDependencyGroupTreeItem';
import { TargetSubsystemGroupTreeItem } from '../targetTreeView/targetSubsystemGroupTreeItem';
import { HealthCheckDependencyTreeItem } from '../treeItems/healthCheckDependencyTreeItem';
import { TargetDescriptionStore } from '../target/targetDescriptionStore';
import { TargetModel } from '../models/targetModel';
import { DisposableCollector } from '../util/disposableCollector';
import { ContainerItem } from '../util/types';
import { loaded } from '../util/loadable';
import { SelectedTargetModel } from '../models/selectedTargetModel';
import { ErrorTreeItem } from '../treeItems/errorTreeItem';

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

function filterContainersForGroup(
    containers: ContainerItem[],
    group: string,
): ContainerItem[] {
    return containers.filter((item) => {
        if (group === 'Host') {
            return item.runtime === manifest.TARGET_HOST_RUNTIME;
        }

        return (
            item.runtime === manifest.TARGET_REMOTEPROC_RUNTIME &&
            item.annotations?.['remoteproc.name'] === group
        );
    });
}

export class TargetTreeView
    implements vscode.TreeDataProvider<vscode.TreeItem>, vscode.Disposable
{
    public static readonly viewId = `${manifest.PACKAGE_NAME}.target-manager`;
    public static readonly focusViewCommand = `${TargetTreeView.viewId}.focus`;

    private _onDidChangeTreeData = new vscode.EventEmitter<undefined>();
    public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private readonly disposables = new DisposableCollector();

    constructor(
        private readonly selectedTargetModel: SelectedTargetModel,
        private readonly targetModel: TargetModel,
        private readonly targetDescriptionStore: TargetDescriptionStore,
    ) {
        const treeView = vscode.window.createTreeView(TargetTreeView.viewId, {
            treeDataProvider: this,
            showCollapseAll: true,
        });

        this.disposables.collect(
            treeView,
            this.targetModel.onSelectedChanged(() => {
                this._onDidChangeTreeData.fire(undefined);
            }),
            this.targetModel.onTargetsChanged(() => {
                this._onDidChangeTreeData.fire(undefined);
            }),
            this.selectedTargetModel.onHealthChanged(() => {
                this._onDidChangeTreeData.fire(undefined);
            }),
            this.selectedTargetModel.onContainersChanged(() => {
                this._onDidChangeTreeData.fire(undefined);
            }),
            this._onDidChangeTreeData,
        );
    }

    public async getChildren(
        element?: vscode.TreeItem,
    ): Promise<vscode.TreeItem[]> {
        if (!element) {
            const selectedTarget = this.targetModel.selected;
            const selectedTargetDescription = selectedTarget
                ? await this.targetDescriptionStore.getDescription(
                      selectedTarget,
                  )
                : undefined;

            const targetTreeItems: TargetTreeItem[] = [];
            for (const target of this.targetModel.targets) {
                const selected = target === selectedTarget;
                const health = selected
                    ? this.selectedTargetModel.health
                    : undefined;
                const targetDescription =
                    selected && selectedTargetDescription
                        ? loaded(selectedTargetDescription)
                        : undefined;
                const otherLoadables = [this.selectedTargetModel.containers];

                targetTreeItems.push(
                    new TargetTreeItem({
                        target,
                        selected,
                        health,
                        targetDescription,
                        otherLoadables,
                    }),
                );
            }
            const sortedTargetTreeItems = targetTreeItems.sort((a, b) =>
                a.displayName.localeCompare(b.displayName),
            );
            return sortedTargetTreeItems;
        }

        if (element instanceof TargetTreeItem) {
            if (!element.selected || element.health.status !== 'loaded') {
                return [];
            }

            const dependenciesGroup = new HealthCheckDependencyGroupTreeItem(
                loaded(element.visibleDependencies, element.health.loading),
            );
            const subsystemsGroup = new TargetSubsystemGroupTreeItem(
                element.target,
                element.remoteProcessorNames,
                this.selectedTargetModel.containers,
            );
            return [dependenciesGroup, subsystemsGroup];
        }

        if (element instanceof HealthCheckDependencyGroupTreeItem) {
            const deps = [...element.dependencies].sort(compareByName);
            return deps.map((d) => new HealthCheckDependencyTreeItem(d));
        }

        if (element instanceof TargetSubsystemGroupTreeItem) {
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

            const groupNames = ['Host', ...element.remoteProcessorNames];
            return groupNames.map((group) => {
                const containers = filterContainersForGroup(
                    sortedContainers,
                    group,
                );

                return new TargetSubsystemTreeItem(
                    group,
                    element.target,
                    containers,
                );
            });
        }

        if (element instanceof TargetSubsystemTreeItem) {
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
