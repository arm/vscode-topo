import * as vscode from 'vscode';
import { getDependencyItemIcon } from './targetTreeDependencyGroupItem';
import { HealthCheckDependency } from '../topoCliSchema';

export class TargetTreeDependencyItem extends vscode.TreeItem {
    constructor(dependency: HealthCheckDependency) {
        super(dependency.Name, vscode.TreeItemCollapsibleState.None);
        const status = dependency.Healthy ? 'Healthy' : 'Unhealthy';
        this.description = dependency.Value;
        this.tooltip = `Status: ${status}\nValue: ${dependency.Value ?? '-'}`;
        this.contextValue = `Dependency ${status}`;
        this.iconPath = getDependencyItemIcon(dependency.Healthy);
    }
}
