import * as vscode from 'vscode';
import { PACKAGE_NAME } from './manifest';
import { TopoCli } from './topoCli';
import { HealthCheckDependency } from './topoCliSchema';
import { TargetTreeDependencyGroupItem } from './workloadPlacement/targetTreeDependencyGroupItem';
import { TargetTreeDependencyItem } from './workloadPlacement/targetTreeDependencyItem';
import { logger } from './util/logger';

const hostHealthTarget = 'localhost';
const failedToLoadHostDependenciesMessage = 'Failed to load host dependencies';

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
        if (!element) {
            try {
                const health = await this.topoCli.health(hostHealthTarget);
                return [
                    new TargetTreeDependencyGroupItem(health.host.dependencies),
                ];
            } catch (err) {
                logger.warn(failedToLoadHostDependenciesMessage, err);
                return [new HostDependenciesLoadErrorItem()];
            }
        }

        if (element instanceof TargetTreeDependencyGroupItem) {
            return sortDependenciesByName([...element.dependencies]).map(
                (dependency) => new TargetTreeDependencyItem(dependency),
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

class HostDependenciesLoadErrorItem extends vscode.TreeItem {
    constructor() {
        super(
            failedToLoadHostDependenciesMessage,
            vscode.TreeItemCollapsibleState.None,
        );
        this.iconPath = new vscode.ThemeIcon(
            'error',
            new vscode.ThemeColor('testing.iconFailed'),
        );
        this.tooltip = 'Check the Topo logs for details.';
    }
}
