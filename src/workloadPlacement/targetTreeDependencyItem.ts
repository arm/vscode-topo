import * as vscode from 'vscode';
import { getDependencyItemIcon } from './targetTreeDependencyGroupItem';
import { HealthCheckDependency } from '../topoCliSchema';

export class TargetTreeDependencyItem extends vscode.TreeItem {
    constructor(dependency: HealthCheckDependency) {
        super(dependency.name, vscode.TreeItemCollapsibleState.None);
        const healthy = dependency.status === 'ok';
        const status = healthy ? 'Healthy' : 'Unhealthy';
        this.description = dependency.value;
        this.tooltip = `Status: ${status}\nValue: ${dependency.value ?? '-'}`;
        this.contextValue = `Dependency ${status}`;
        this.iconPath = getDependencyItemIcon(healthy);
    }
}
