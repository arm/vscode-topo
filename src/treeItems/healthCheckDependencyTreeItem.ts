import * as vscode from 'vscode';
import { IssueCheck } from '../topoCliSchema';
import { getDependencyItemIcon } from '../views/util/dependencyIcons';
import { Loaded } from '../util/loadable';

const capitalizeFirstLetter = (s: string) => {
    return s.charAt(0).toUpperCase() + s.slice(1);
};

export class HealthCheckDependencyTreeItem extends vscode.TreeItem {
    constructor(public readonly dependency: Loaded<IssueCheck>) {
        const dependencyData = dependency.data;
        super(dependencyData.name, vscode.TreeItemCollapsibleState.None);
        this.description = dependencyData.value;

        const statusCapitalized = capitalizeFirstLetter(dependencyData.status);
        this.tooltip = `Status: ${statusCapitalized}\nValue: ${dependencyData.value ?? '-'}`;
        this.contextValue = [
            'Dependency',
            statusCapitalized,
            dependencyData.fix?.command ? 'Fixable' : undefined,
        ]
            .filter(Boolean)
            .join(' ');
        this.iconPath = dependency.loading
            ? new vscode.ThemeIcon('loading~spin')
            : getDependencyItemIcon(dependencyData.status);
    }
}
