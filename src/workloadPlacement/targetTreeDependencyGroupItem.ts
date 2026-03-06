import * as vscode from 'vscode';
import { HealthCheckDependency } from '../topoCliSchema';

export const getDependencyGroupIcon = (healthy: boolean): vscode.ThemeIcon => {
    if (healthy) {
        return new vscode.ThemeIcon('library');
    }

    return new vscode.ThemeIcon(
        'warning',
        new vscode.ThemeColor('testing.iconFailed'),
    );
};

export const getDependencyItemIcon = (
    healthy: boolean,
): vscode.ThemeIcon | undefined => {
    if (healthy) {
        return new vscode.ThemeIcon(
            'check',
            new vscode.ThemeColor('testing.iconPassed'),
        );
    }

    return new vscode.ThemeIcon(
        'warning',
        new vscode.ThemeColor('testing.iconFailed'),
    );
};

export class TargetTreeDependencyGroupItem extends vscode.TreeItem {
    public readonly dependencies: HealthCheckDependency[];

    constructor(dependencies: HealthCheckDependency[]) {
        super('Dependencies', vscode.TreeItemCollapsibleState.Collapsed);
        this.contextValue = 'Dependencies';
        this.dependencies = dependencies;

        const healthy =
            dependencies.length > 0 &&
            dependencies.every((dependency) => dependency.healthy);
        this.iconPath = getDependencyGroupIcon(healthy);
    }
}
