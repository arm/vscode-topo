import * as vscode from 'vscode';
import { HealthCheckStatus } from '../../topoCliSchema';

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

export const getDependencyGroupIcon = (
    status: HealthCheckStatus,
): vscode.ThemeIcon => {
    if (status === 'ok') {
        return new vscode.ThemeIcon('library');
    }

    return getDependencyItemIcon(status);
};
