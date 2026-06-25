import * as vscode from 'vscode';
import { HealthCheckStatus } from '../../topoCliSchema';

export const getHealthCheckIcon = (
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

export const getHealthGroupIcon = (
    status: HealthCheckStatus,
): vscode.ThemeIcon => {
    if (status === 'ok') {
        return new vscode.ThemeIcon('library');
    }

    return getHealthCheckIcon(status);
};
