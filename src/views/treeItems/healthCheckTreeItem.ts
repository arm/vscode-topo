import * as vscode from 'vscode';
import { HealthCheck } from '../../services/topoCliSchema';
import { getHealthCheckIcon } from '../util/healthIcons';
import { Loaded } from '../../util/loadable';

const capitalizeFirstLetter = (s: string) => {
    return s.charAt(0).toUpperCase() + s.slice(1);
};

export class HealthCheckTreeItem extends vscode.TreeItem {
    constructor(public readonly healthCheck: Loaded<HealthCheck>) {
        const healthCheckData = healthCheck.data;
        super(healthCheckData.name, vscode.TreeItemCollapsibleState.None);
        this.description = healthCheckData.value;

        const statusCapitalized = capitalizeFirstLetter(healthCheckData.status);
        this.tooltip = `Status: ${statusCapitalized}\nValue: ${healthCheckData.value ?? '-'}`;
        this.contextValue = [
            'HealthCheck',
            statusCapitalized,
            healthCheckData.fix?.command ? 'Fixable' : undefined,
        ]
            .filter(Boolean)
            .join(' ');
        this.iconPath = healthCheck.loading
            ? new vscode.ThemeIcon('loading~spin')
            : getHealthCheckIcon(healthCheckData.status);
    }
}
