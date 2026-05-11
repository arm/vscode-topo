import * as vscode from 'vscode';
import { PACKAGE_NAME } from '../manifest';
import { TopoCli } from '../topoCli';
import { HealthCheckDependency } from '../topoCliSchema';
import { HealthCheckDependencyGroupTreeItem } from '../treeItems/healthCheckDependencyGroupTreeItem';
import { HealthCheckDependencyTreeItem } from '../treeItems/healthCheckDependencyTreeItem';
import { logger } from '../util/logger';
import {
    failedToLoadHostDependenciesMessage,
    HostDependenciesLoadErrorItem,
} from './hostDependenciesLoadErrorItem';
import { showTopoOutputCommand } from '../showTopoOutputCommand';

const hostHealthTarget = 'localhost';

function sortDependenciesByName(
    deps: HealthCheckDependency[],
): HealthCheckDependency[] {
    return deps.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
}

export class HostDependenciesTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    public static readonly viewId = `${PACKAGE_NAME}.host-manager`;
    public static readonly refreshCommand = `${PACKAGE_NAME}.refreshHostDependencies`;

    private _onDidChangeTreeData = new vscode.EventEmitter<undefined>();
    public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly topoCli: TopoCli,
    ) {}

    public activate(): void {
        const treeView = vscode.window.createTreeView(
            HostDependenciesTreeDataProvider.viewId,
            {
                treeDataProvider: this,
                showCollapseAll: false,
            },
        );

        this.context.subscriptions.push(
            treeView,
            vscode.commands.registerCommand(
                HostDependenciesTreeDataProvider.refreshCommand,
                this.handleRefreshCommand.bind(this),
            ),
            vscode.commands.registerCommand(
                showTopoOutputCommand,
                this.handleShowTopoOutputCommand.bind(this),
            ),
            this._onDidChangeTreeData,
        );
    }

    private handleRefreshCommand(): void {
        this.refresh();
    }

    private handleShowTopoOutputCommand(): void {
        logger.show();
    }

    public async getChildren(
        element?: vscode.TreeItem,
    ): Promise<vscode.TreeItem[]> {
        if (!element) {
            try {
                const health = await this.topoCli.health(hostHealthTarget);
                const dependenciesGroup =
                    new HealthCheckDependencyGroupTreeItem(
                        health.host.dependencies,
                    );
                return [dependenciesGroup];
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

    public refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }
}
