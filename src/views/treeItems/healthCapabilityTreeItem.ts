import * as vscode from 'vscode';
import { HealthCheck } from '../../services/topoCliSchema';
import { loaded, type Loaded } from '../../util/loadable';
import { getHealthGroupIcon } from '../util/healthIcons';
import { HealthCheckTreeItem } from './healthCheckTreeItem';

export class HealthCapabilityTreeItem extends vscode.TreeItem {
    constructor(
        private readonly healthChecks: Loaded<HealthCheck[]>,
        name: string,
    ) {
        super(name, vscode.TreeItemCollapsibleState.Collapsed);

        this.iconPath = getHealthGroupIcon(
            healthChecks.data,
            healthChecks.loading,
        );
    }

    public getChildren(): HealthCheckTreeItem[] {
        return this.healthChecks.data.map(
            (healthCheck) =>
                new HealthCheckTreeItem(
                    loaded(healthCheck, this.healthChecks.loading),
                ),
        );
    }
}
