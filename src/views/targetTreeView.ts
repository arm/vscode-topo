import * as vscode from 'vscode';
import { TargetContainerTreeItem } from '../targetTreeView/targetContainerTreeItem';
import { ContainersManager } from '../target/containersManager';
import * as manifest from '../manifest';
import { TargetStore } from '../target/targetStore';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import { TargetSubsystemTreeItem } from '../targetTreeView/targetSubsystemTreeItem';
import { HealthCheckDependencyGroupTreeItem } from '../treeItems/healthCheckDependencyGroupTreeItem';
import { TargetSubsystemGroupTreeItem } from '../targetTreeView/targetSubsystemGroupTreeItem';
import { HealthCheckDependencyTreeItem } from '../treeItems/healthCheckDependencyTreeItem';
import { HealthCheckDependency } from '../topoCliSchema';
import { TargetDescriptionStore } from '../target/targetDescriptionStore';
import { getVisibleTargetDependencies } from '../target/getVisibleTargetDependencies';
import { DisposableCollector } from '../util/disposableCollector';

function sortDependenciesByName(
    deps: HealthCheckDependency[],
): HealthCheckDependency[] {
    return deps.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
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
        private readonly targetStore: TargetStore,
        private readonly targetDescriptionStore: TargetDescriptionStore,
    ) {
        const treeView = vscode.window.createTreeView(TargetTreeView.viewId, {
            treeDataProvider: this,
            showCollapseAll: true,
        });

        this.disposables.collect(
            treeView,
            this.targetStore.onChanged(() => {
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
            const selectedTarget = this.targetStore.getSelectedTarget();
            const targetTreeItems = this.targetStore
                .getTargets()
                .map((target) => {
                    const selected = target === selectedTarget;
                    const { status } =
                        this.containersManager.getTargetStateSnapshot(target);
                    return new TargetTreeItem(target, selected, status);
                });
            const sortedTargetTreeItems = targetTreeItems.sort((a, b) =>
                a.displayName.localeCompare(b.displayName),
            );
            return sortedTargetTreeItems;
        }

        if (element instanceof TargetTreeItem) {
            if (!element.selected) {
                return [];
            }
            const [targetState, selectedTargetDescription] = await Promise.all([
                this.containersManager.getTargetState(element.target),
                this.targetDescriptionStore.getDescription(element.target),
            ]);
            if (targetState.health === undefined) {
                return [];
            }

            const dependencies = getVisibleTargetDependencies(
                targetState.health,
                selectedTargetDescription,
            );

            const dependenciesGroup = new HealthCheckDependencyGroupTreeItem(
                dependencies,
            );
            const subsystemsGroup = new TargetSubsystemGroupTreeItem(
                element.target,
            );
            return [dependenciesGroup, subsystemsGroup];
        }

        if (element instanceof HealthCheckDependencyGroupTreeItem) {
            return sortDependenciesByName(element.dependencies).map(
                (d) => new HealthCheckDependencyTreeItem(d),
            );
        }

        if (element instanceof TargetSubsystemGroupTreeItem) {
            const targetDescription =
                await this.targetDescriptionStore.getDescription(
                    element.target,
                );
            const remoteProcessors =
                targetDescription?.remoteProcessors.map((rp) => rp.name) || [];
            const subsystemNames = ['Host', ...remoteProcessors];
            return subsystemNames.map(
                (name) => new TargetSubsystemTreeItem(name, element.target),
            );
        }

        if (element instanceof TargetSubsystemTreeItem) {
            const containers = await this.containersManager.getContainersData(
                element.target,
            );
            const subsystemContainers = containers.filter((item) =>
                element.group === 'Host'
                    ? item.runtime === manifest.TARGET_HOST_RUNTIME
                    : item.runtime === manifest.TARGET_REMOTEPROC_RUNTIME &&
                      item.annotations?.['remoteproc.name'] === element.group,
            );
            const subsystemTreeItems = subsystemContainers.map(
                (info) => new TargetContainerTreeItem(info),
            );
            const sortedSubsystemTreeItems = subsystemTreeItems.sort((a, b) => {
                if (a.state === 'running' && b.state !== 'running') {
                    return -1;
                }
                if (a.state !== 'running' && b.state === 'running') {
                    return 1;
                }
                return a.name.localeCompare(b.name);
            });
            return sortedSubsystemTreeItems;
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
