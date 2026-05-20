import * as vscode from 'vscode';
import { PACKAGE_NAME } from '../manifest';
import { HealthCheckDependency } from '../topoCliSchema';
import { HealthCheckDependencyGroupTreeItem } from '../treeItems/healthCheckDependencyGroupTreeItem';
import { HealthCheckDependencyTreeItem } from '../treeItems/healthCheckDependencyTreeItem';
import { logger } from '../util/logger';
import {
    failedToLoadHostDependenciesMessage,
    HostDependenciesLoadErrorItem,
} from './hostDependenciesLoadErrorItem';
import { HostModel } from '../models/hostModel';

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

    constructor(private readonly model: HostModel) {}

    public activate(): void {
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

    public async getChildren(
        element?: vscode.TreeItem,
    ): Promise<vscode.TreeItem[]> {
        if (!element) {
            try {
                const health = await this.model.health;
                const deps = health.host.dependencies;
                return [new HealthCheckDependencyGroupTreeItem(deps)];
            } catch (err) {
                logger.warn(failedToLoadHostDependenciesMessage, err);
                return [new HostDependenciesLoadErrorItem()];
            }
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
