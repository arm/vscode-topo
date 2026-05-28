import * as vscode from 'vscode';
import { HealthCheckDependency } from '../topoCliSchema';
import { getDependencyItemIcon } from '../views/util/getDependencyStatusIcon';

const capitalizeFirstLetter = (s: string) => {
    return s.charAt(0).toUpperCase() + s.slice(1);
};

export class HealthCheckDependencyTreeItem extends vscode.TreeItem {
    constructor(public readonly dependency: HealthCheckDependency) {
        super(dependency.name, vscode.TreeItemCollapsibleState.None);
        this.description = dependency.value;

        const statusCapitalized = capitalizeFirstLetter(dependency.status);
        this.tooltip = `Status: ${statusCapitalized}\nValue: ${dependency.value ?? '-'}`;
        this.contextValue = [
            'Dependency',
            statusCapitalized,
            dependency.fix?.command ? 'Fixable' : undefined,
        ]
            .filter(Boolean)
            .join(' ');
        this.iconPath = getDependencyItemIcon(dependency.status);
    }
}
