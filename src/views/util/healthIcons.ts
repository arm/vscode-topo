import * as vscode from 'vscode';
import type {
    HealthCheck,
    HealthCheckStatus,
} from '../../services/topoCliSchema';
import { getWorstHealthCheckStatus } from '../../util/getWorstHealthCheckStatus';
import type { Loaded } from '../../util/loadable';

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

    if (status === 'info') {
        return new vscode.ThemeIcon('info');
    }

    if (status === 'undetermined') {
        return new vscode.ThemeIcon('question');
    }

    return new vscode.ThemeIcon(
        'close',
        new vscode.ThemeColor('testing.iconFailed'),
    );
};

export const getHealthGroupIcon = (
    healthChecks: Loaded<HealthCheck[]>,
): vscode.ThemeIcon => {
    return healthChecks.loading
        ? new vscode.ThemeIcon('loading~spin')
        : getHealthCheckIcon(getWorstHealthCheckStatus(healthChecks.data));
};
