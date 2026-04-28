import * as vscode from 'vscode';
import { HealthCheckDependency, HealthCheckStatus } from '../topoCliSchema';

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

const getInstallableContext = (
    dependency: HealthCheckDependency,
): string | undefined => {
    if (dependency.status === 'ok') {
        return undefined;
    }

    if (
        dependency.name === 'Remoteproc Runtime' ||
        dependency.name === 'Remoteproc Shim'
    ) {
        return 'Installable:remoteproc-runtime';
    }

    return undefined;
};

export class TargetTreeDependencyItem extends vscode.TreeItem {
    constructor(dependency: HealthCheckDependency) {
        super(dependency.name, vscode.TreeItemCollapsibleState.None);
        this.description = dependency.value;

        const statusCapitalized = capitalizeFirstLetter(dependency.status);
        this.tooltip = `Status: ${statusCapitalized}\nValue: ${dependency.value ?? '-'}`;
        this.contextValue = [
            'Dependency',
            statusCapitalized,
            getInstallableContext(dependency),
        ]
            .filter(Boolean)
            .join(' ');
        this.iconPath = getDependencyItemIcon(dependency.status);
    }
}
