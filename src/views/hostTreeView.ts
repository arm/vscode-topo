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
import { Loadable } from '../util/types';

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

    private disposables: vscode.Disposable[] = [];

    private _onDidChangeTreeData = new vscode.EventEmitter<undefined>();
    public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private readonly model: HostModel) {
        const treeView = vscode.window.createTreeView(HostTreeView.viewId, {
            treeDataProvider: this,
            showCollapseAll: false,
        });

        this.disposables.push(
            treeView,
            this._onDidChangeTreeData,
            this.model.onHealthChanged(() => {
                this._onDidChangeTreeData.fire(undefined);
            }),
        );
    }

    private getRootItem(
        health: Loadable<HostHealthCheckResult>,
    ): vscode.TreeItem {
        if (health.status === 'error') {
            logger.warn(failedToLoadHostDependenciesMessage, health.error);
            return new HostDependenciesLoadErrorItem();
        }

        if (health.status === 'loading') {
            const item = this.getRootItem(health.placeholder);
            item.iconPath = new vscode.ThemeIcon('loading~spin');
            return item;
        }

        const deps = health.data.host.dependencies;
        return new HealthCheckDependencyGroupTreeItem(deps);
    }

    public getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
        if (!element) {
            return [this.getRootItem(this.model.health)];
        }

        if (element instanceof HealthCheckDependencyGroupTreeItem) {
            return sortDependenciesByName([...element.dependencies]).map(
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
        for (const disposable of [...this.disposables].reverse()) {
            disposable.dispose();
        }
        this.disposables = [];
    }
}
