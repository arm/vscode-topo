import * as vscode from 'vscode';
import { PACKAGE_NAME } from './manifest';
import { TopoCli } from './topoCli';
import { HealthCheckDependency } from './topoCliSchema';
import { TargetTreeDependencyGroupItem } from './workloadPlacement/targetTreeDependencyGroupItem';
import { TargetTreeDependencyItem } from './workloadPlacement/targetTreeDependencyItem';
import { logger } from './util/logger';

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

    private _onDidChangeTreeData = new vscode.EventEmitter<
        vscode.TreeItem | undefined
    >();
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
                () => this.refresh(),
            ),
            this._onDidChangeTreeData,
        );
    }

    public async getChildren(
        element?: vscode.TreeItem,
    ): Promise<vscode.TreeItem[]> {
        try {
            const health = await this.topoCli.health(hostHealthTarget);
            if (!element) {
                return [
                    new TargetTreeDependencyGroupItem(health.host.dependencies),
                ];
            }

            if (element instanceof TargetTreeDependencyGroupItem) {
                return sortDependenciesByName([...element.dependencies]).map(
                    (dependency) => new TargetTreeDependencyItem(dependency),
                );
            }

            return [];
        } catch (err) {
            logger.warn('Failed to load host dependencies', err);
            return [];
        }
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
