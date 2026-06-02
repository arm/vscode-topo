import * as vscode from 'vscode';
import { TargetContainerTreeItem } from '../targetTreeView/targetContainerTreeItem';
import { ContainersManager } from '../target/containersManager';
import * as manifest from '../manifest';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import { TargetSubsystemTreeItem } from '../targetTreeView/targetSubsystemTreeItem';
import { HealthCheckDependencyGroupTreeItem } from '../treeItems/healthCheckDependencyGroupTreeItem';
import { TargetSubsystemGroupTreeItem } from '../targetTreeView/targetSubsystemGroupTreeItem';
import { HealthCheckDependencyTreeItem } from '../treeItems/healthCheckDependencyTreeItem';
import { HealthCheckDependency } from '../topoCliSchema';
import { TargetDescriptionStore } from '../target/targetDescriptionStore';
import { TargetModel } from '../models/targetModel';
import { DisposableCollector } from '../util/disposableCollector';
import { ContainerItem, TargetState } from '../util/types';

function sortDependenciesByName(
    deps: HealthCheckDependency[],
): HealthCheckDependency[] {
    return deps.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
}

function filterAndSortContainerItemsForGroup(
    containers: ContainerItem[],
    group: string,
): ContainerItem[] {
    const subsystemContainers = containers.filter((item) => {
        if (group === 'Host') {
            return item.runtime === manifest.TARGET_HOST_RUNTIME;
        }

        return (
            item.runtime === manifest.TARGET_REMOTEPROC_RUNTIME &&
            item.annotations?.['remoteproc.name'] === group
        );
    });

    return subsystemContainers.sort((a, b) => {
        if (a.state === 'running' && b.state !== 'running') {
            return -1;
        }
        if (a.state !== 'running' && b.state === 'running') {
            return 1;
        }
        return a.name.localeCompare(b.name);
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
        private readonly containersManager: ContainersManager,
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
            this.containersManager.onDataUpdate(() => {
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
            const targetTreeItems: TargetTreeItem[] = [];
            for (const target of this.targetModel.targets) {
                const selected = target === selectedTarget;

                const state: TargetState = selected
                    ? this.containersManager.getTargetStateSnapshot(target)
                    : { status: 'disconnected', health: undefined };

                const description = selected
                    ? await this.targetDescriptionStore.getDescription(target)
                    : undefined;

                targetTreeItems.push(
                    new TargetTreeItem(target, selected, state, description),
                );
            }
            const sortedTargetTreeItems = targetTreeItems.sort((a, b) =>
                a.displayName.localeCompare(b.displayName),
            );
            return sortedTargetTreeItems;
        }

        if (element instanceof TargetTreeItem) {
            if (!element.state.health) {
                return [];
            }

            const dependenciesGroup = new HealthCheckDependencyGroupTreeItem(
                element.visibleDependencies,
            );
            const subsystemsGroup = new TargetSubsystemGroupTreeItem(
                element.target,
                element.targetDescription,
            );
            return [dependenciesGroup, subsystemsGroup];
        }

        if (element instanceof HealthCheckDependencyGroupTreeItem) {
            return sortDependenciesByName(element.dependencies).map(
                (d) => new HealthCheckDependencyTreeItem(d),
            );
        }

        if (element instanceof TargetSubsystemGroupTreeItem) {
            const allContainers =
                await this.containersManager.getContainersData(element.target);

            const remoteProcessors =
                element.targetDescription?.remoteProcessors.map(
                    (rp) => rp.name,
                ) ?? [];
            const groupNames = ['Host', ...remoteProcessors];
            return groupNames.map((group) => {
                const containers = filterAndSortContainerItemsForGroup(
                    allContainers,
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
