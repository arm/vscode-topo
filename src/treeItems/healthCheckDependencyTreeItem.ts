import * as vscode from 'vscode';
import { IssueCheck } from '../topoCliSchema';
import { getDependencyItemIcon } from '../views/util/dependencyIcons';

const capitalizeFirstLetter = (s: string) => {
    return s.charAt(0).toUpperCase() + s.slice(1);
};

interface HealthCheckDependencyTreeItemOptions {
    readonly loading?: boolean;
}

export class HealthCheckDependencyTreeItem extends vscode.TreeItem {
    constructor(
        public readonly dependency: IssueCheck,
        options: HealthCheckDependencyTreeItemOptions = {},
    ) {
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
        this.iconPath = options.loading
            ? new vscode.ThemeIcon('loading~spin')
            : getDependencyItemIcon(dependency.status);
    }
}
