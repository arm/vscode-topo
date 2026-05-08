import * as vscode from 'vscode';
import { HealthCheckDependency, HealthCheckStatus } from '../topoCliSchema';
import { getDependencyItemIcon } from './healthCheckDependencyTreeItem';

const getDependencyGroupIcon = (
    status: HealthCheckStatus,
): vscode.ThemeIcon => {
    if (status === 'ok') {
        return new vscode.ThemeIcon('library');
    }

    return getDependencyItemIcon(status);
};

const getWorstDependencyStatus = (
    dependencies: HealthCheckDependency[],
): HealthCheckStatus => {
    return dependencies.reduce((acc: HealthCheckStatus, dependency) => {
        if (dependency.status === 'error') {
            return 'error';
        }
        if (dependency.status === 'warning' && acc !== 'error') {
            return 'warning';
        }
        return acc;
    }, 'ok');
};

export class HealthCheckDependencyGroupTreeItem extends vscode.TreeItem {
    public readonly dependencies: HealthCheckDependency[];

    constructor(dependencies: HealthCheckDependency[]) {
        super('Dependencies', vscode.TreeItemCollapsibleState.Collapsed);
        this.contextValue = 'Dependencies';
        this.dependencies = dependencies;

        const status = getWorstDependencyStatus(dependencies);
        this.iconPath = getDependencyGroupIcon(status);
    }
}
