import * as vscode from 'vscode';
import { HealthCheck } from '../../services/topoCliSchema';
import { loaded, type Loaded } from '../../util/loadable';
import { getHealthGroupIcon } from '../util/healthIcons';
import { HealthCheckTreeItem } from './healthCheckTreeItem';

export class HealthCapabilityTreeItem extends vscode.TreeItem {
    public readonly healthChecks: readonly HealthCheck[];
    public readonly loading: boolean;

    constructor(healthChecks: Loaded<HealthCheck[]>, name: string) {
        super(name, vscode.TreeItemCollapsibleState.Collapsed);
        this.healthChecks = healthChecks.data;
        this.loading = healthChecks.loading;

        this.iconPath = getHealthGroupIcon(this.healthChecks, this.loading);
    }

    public getChildren(): HealthCheckTreeItem[] {
        return this.healthChecks.map(
            (healthCheck) =>
                new HealthCheckTreeItem(loaded(healthCheck, this.loading)),
        );
    }
}
