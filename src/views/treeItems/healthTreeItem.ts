import * as vscode from 'vscode';
import type { HealthCheck } from '../../services/topoCliSchema';
import { getHealthChecks, type Health } from '../../util/healthReport';
import { loaded, type Loaded } from '../../util/loadable';
import { hasFixCommand } from '../../util/issueFixes';
import { getHealthGroupIcon } from '../util/healthIcons';
import { HealthCapabilityTreeItem } from './healthCapabilityTreeItem';

export class HealthTreeItem extends vscode.TreeItem {
    public readonly healthChecks: readonly HealthCheck[];

    constructor(private readonly health: Loaded<Health>) {
        super('Health', vscode.TreeItemCollapsibleState.Collapsed);
        this.healthChecks = getHealthChecks(health.data);

        this.contextValue = this.healthChecks.some(hasFixCommand)
            ? 'Health HasFixableIssues'
            : 'Health';
        this.iconPath = getHealthGroupIcon(this.healthChecks, health.loading);
    }

    public getChildren(): HealthCapabilityTreeItem[] {
        return this.health.data.capabilities.map(
            ({ name, checks }) =>
                new HealthCapabilityTreeItem(
                    loaded(checks, this.health.loading),
                    name,
                ),
        );
    }
}
