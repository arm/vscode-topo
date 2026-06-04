import * as vscode from 'vscode';
import { PACKAGE_NAME } from '../manifest';
import { HealthCheckDependency, HostHealthCheckResult } from '../topoCliSchema';
import { HealthCheckDependencyGroupTreeItem } from '../treeItems/healthCheckDependencyGroupTreeItem';
import { HealthCheckDependencyTreeItem } from '../treeItems/healthCheckDependencyTreeItem';
import { logger } from '../util/logger';
import {
    failedToLoadHostDependenciesMessage,
    HostDependenciesLoadErrorItem,
} from '../treeItems/hostDependenciesLoadErrorItem';
import { HostModel } from '../models/hostModel';
import { DisposableCollector } from '../util/disposableCollector';
import { Loadable } from '../util/loadable';

function sortDependenciesByName(
    deps: HealthCheckDependency[],
): HealthCheckDependency[] {
    return deps.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
}

export class HostTreeView
    implements vscode.TreeDataProvider<vscode.TreeItem>, vscode.Disposable
{
    public static readonly viewId = `${PACKAGE_NAME}.host-manager`;

    private readonly disposables = new DisposableCollector();

    private _onDidChangeTreeData = new vscode.EventEmitter<undefined>();
    public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private readonly model: HostModel) {
        const treeView = vscode.window.createTreeView(HostTreeView.viewId, {
            treeDataProvider: this,
            showCollapseAll: false,
        });

        this.disposables.collect(
            treeView,
            this._onDidChangeTreeData,
            this.model.onHealthChanged(() => {
                this._onDidChangeTreeData.fire(undefined);
            }),
        );
    }

    public getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
        if (!element) {
            const health = this.model.health;
            if (health.status === 'errored') {
                logger.warn(failedToLoadHostDependenciesMessage, health.error);
                return [new HostDependenciesLoadErrorItem()];
            }

            const deps = sortDependenciesByName(health.data.host.dependencies);
            return [
                new HealthCheckDependencyGroupTreeItem(deps, health.loading),
            ];
        }

        if (element instanceof HealthCheckDependencyGroupTreeItem) {
            return element.dependencies.map(
                (dependency) => new HealthCheckDependencyTreeItem(dependency),
            );
        }

        return [];
    }

    public getTreeItem(
        element: vscode.TreeItem,
    ): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    public dispose(): void {
        this.disposables.dispose();
    }
}
