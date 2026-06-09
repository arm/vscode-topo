import * as vscode from 'vscode';
import { TargetContainerTreeItem } from '../targetTreeView/targetContainerTreeItem';
import { ContainersManager } from '../target/containersManager';
import * as manifest from '../manifest';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import { TargetSubsystemTreeItem } from '../targetTreeView/targetSubsystemTreeItem';
import { HealthCheckDependencyGroupTreeItem } from '../treeItems/healthCheckDependencyGroupTreeItem';
import { TargetSubsystemGroupTreeItem } from '../targetTreeView/targetSubsystemGroupTreeItem';
import { HealthCheckDependencyTreeItem } from '../treeItems/healthCheckDependencyTreeItem';
import { TargetDescriptionStore } from '../target/targetDescriptionStore';
import { TargetModel } from '../models/targetModel';
import { DisposableCollector } from '../util/disposableCollector';
import { ContainerItem, TargetState } from '../util/types';
import { errored, Loadable, loaded } from '../util/loadable';
import { TargetHealthCheckResult } from '../topoCliSchema';

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
                const health = selected
                    ? targetHealthLoadable(state)
                    : undefined;
                const description =
                    health?.status === 'loaded' && health.data
                        ? await this.targetDescriptionStore.getDescription(
                              target,
                          )
                        : undefined;

                targetTreeItems.push(
                    new TargetTreeItem({
                        target,
                        selected,
                        health,
                        targetDescription: description
                            ? loaded(description)
                            : undefined,
                    }),
                );
            }
            const sortedTargetTreeItems = targetTreeItems.sort((a, b) =>
                a.displayName.localeCompare(b.displayName),
            );
            return sortedTargetTreeItems;
        }

        if (element instanceof TargetTreeItem) {
            if (!element.selected || !element.connected) {
                return [];
            }
            const containers = await this.containersManager.getContainersData(
                element.target,
            );
            const sortedContainers = [...containers].sort(compareContainers);

            const dependenciesGroup = new HealthCheckDependencyGroupTreeItem(
                loaded(element.visibleDependencies, element.health.loading),
            );
            const subsystemsGroup = new TargetSubsystemGroupTreeItem(
                element.target,
                element.remoteProcessorNames,
                sortedContainers,
            );
            return [dependenciesGroup, subsystemsGroup];
        }

        if (element instanceof HealthCheckDependencyGroupTreeItem) {
            const deps = [...element.dependencies].sort(compareByName);
            return deps.map((d) => new HealthCheckDependencyTreeItem(d));
        }

        if (element instanceof TargetSubsystemGroupTreeItem) {
            const groupNames = ['Host', ...element.remoteProcessorNames];
            return groupNames.map((group) => {
                const containers = filterContainersForGroup(
                    element.containers,
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
