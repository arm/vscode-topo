import * as vscode from 'vscode';
import { HealthCheckDependency, HealthCheckStatus } from '../topoCliSchema';
import { getInstallableDependencyCommand } from '../util/getInstallableDependency';

export const getDependencyItemIcon = (
    status: HealthCheckStatus,
): vscode.ThemeIcon => {
    if (status === 'ok') {
        return new vscode.ThemeIcon(
            'check',
            new vscode.ThemeColor('testing.iconPassed'),
        );
    }

    if (status === 'warning') {
        return new vscode.ThemeIcon(
            'warning',
            new vscode.ThemeColor('testing.iconQueued'),
        );
    }

    return new vscode.ThemeIcon(
        'close',
        new vscode.ThemeColor('testing.iconFailed'),
    );
};

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
            getInstallableDependencyCommand(dependency)
                ? 'Installable'
                : undefined,
        ]
            .filter(Boolean)
            .join(' ');
        this.iconPath = getDependencyItemIcon(dependency.status);
    }
}
