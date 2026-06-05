import * as vscode from 'vscode';
import { HealthCheckDependency } from '../topoCliSchema';
import { getWorstDependencyStatus } from '../util/getWorstDependencyStatus';
import { getDependencyGroupIcon } from '../views/util/dependencyIcons';
import { Loaded } from '../util/loadable';

export class HealthCheckDependencyGroupTreeItem extends vscode.TreeItem {
    public readonly dependencies: HealthCheckDependency[];

    constructor(dependencies: Loaded<HealthCheckDependency[]>) {
        super('Dependencies', vscode.TreeItemCollapsibleState.Collapsed);
        this.contextValue = 'Dependencies';
        this.dependencies = dependencies.data;

        const worstDepStatus = getWorstDependencyStatus(dependencies.data);
        this.iconPath = getDependencyGroupIcon(worstDepStatus);
        if (dependencies.loading) {
            this.iconPath = new vscode.ThemeIcon('loading~spin');
        }
    }
}
