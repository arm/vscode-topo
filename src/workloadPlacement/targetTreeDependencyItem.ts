import * as vscode from 'vscode';
import { HealthCheckDependency, HealthCheckStatus } from '../topoCliSchema';
import { getInstallableDependency } from '../actions/installDependency';

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

export class TargetTreeDependencyItem extends vscode.TreeItem {
    public readonly dependency: HealthCheckDependency;

    constructor(dependency: HealthCheckDependency) {
        super(dependency.name, vscode.TreeItemCollapsibleState.None);
        this.description = dependency.value;
        this.dependency = dependency;

        const statusCapitalized = capitalizeFirstLetter(dependency.status);
        this.tooltip = `Status: ${statusCapitalized}\nValue: ${dependency.value ?? '-'}`;
        this.contextValue = [
            'Dependency',
            statusCapitalized,
            getInstallableDependency(dependency) ? 'Installable' : undefined,
        ]
            .filter(Boolean)
            .join(' ');
        this.iconPath = getDependencyItemIcon(dependency.status);
    }
}
