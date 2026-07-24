import * as vscode from 'vscode';
import { HealthCheck } from '../../services/topoCliSchema';
import { getWorstHealthCheckStatus } from '../../util/getWorstHealthCheckStatus';
import { getHealthCheckIcon } from '../util/healthIcons';
import { Loaded } from '../../util/loadable';
import { hasFixCommand } from '../../util/issueFixes';

export class HealthCheckGroupTreeItem extends vscode.TreeItem {
    public readonly healthChecks: readonly HealthCheck[];

    constructor(healthChecks: Loaded<readonly HealthCheck[]>) {
        super('Health', vscode.TreeItemCollapsibleState.Collapsed);
        this.contextValue = 'Health';
        if (healthChecks.data.some(hasFixCommand)) {
            this.contextValue += ' HasFixableIssues';
        }
        this.healthChecks = healthChecks.data;

        const worstStatus = getWorstHealthCheckStatus(healthChecks.data);
        this.iconPath = getHealthCheckIcon(worstStatus);
        if (healthChecks.loading) {
            this.iconPath = new vscode.ThemeIcon('loading~spin');
        }
    }
}
