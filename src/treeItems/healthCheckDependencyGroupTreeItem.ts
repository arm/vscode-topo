import * as vscode from 'vscode';
import { HealthCheckDependency } from '../topoCliSchema';
import { getWorstDependencyStatus } from '../util/getWorstDependencyStatus';
import { getDependencyGroupIcon } from '../views/util/dependencyIcons';

export class HealthCheckDependencyGroupTreeItem extends vscode.TreeItem {
    public readonly dependencies: HealthCheckDependency[];

    constructor(dependencies: HealthCheckDependency[], loading: boolean) {
        super('Dependencies', vscode.TreeItemCollapsibleState.Collapsed);
        this.contextValue = 'Dependencies';
        this.dependencies = dependencies;

        const worstDepStatus = getWorstDependencyStatus(dependencies);
        this.iconPath = getDependencyGroupIcon(worstDepStatus);
        if (loading) {
            this.iconPath = new vscode.ThemeIcon('loading~spin');
        }
    }
}
