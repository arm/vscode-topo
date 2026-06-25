import * as vscode from 'vscode';
import { HealthCheck } from '../topoCliSchema';
import { getWorstHealthCheckStatus } from '../util/getWorstHealthCheckStatus';
import { getHealthGroupIcon } from '../views/util/healthIcons';
import { Loaded } from '../util/loadable';
import { hasFixCommand } from '../util/issueFixes';

export class HealthCheckGroupTreeItem extends vscode.TreeItem {
    public readonly healthChecks: HealthCheck[];

    constructor(healthChecks: Loaded<HealthCheck[]>) {
        super('Health', vscode.TreeItemCollapsibleState.Collapsed);
        this.contextValue = 'Health';
        if (healthChecks.data.some(hasFixCommand)) {
            this.contextValue += ' HasFixableIssues';
        }
        this.healthChecks = healthChecks.data;

        const worstStatus = getWorstHealthCheckStatus(healthChecks.data);
        this.iconPath = getHealthGroupIcon(worstStatus);
        if (healthChecks.loading) {
            this.iconPath = new vscode.ThemeIcon('loading~spin');
        }
    }
}
