import * as vscode from 'vscode';
import { HealthCheck } from '../../services/topoCliSchema';
import { Loaded } from '../../util/loadable';
import { getHealthGroupIcon } from '../util/healthIcons';

export class HealthCapabilityTreeItem extends vscode.TreeItem {
    public readonly healthChecks: readonly HealthCheck[];
    public readonly loading: boolean;

    constructor(healthChecks: Loaded<HealthCheck[]>, name: string) {
        super(name, vscode.TreeItemCollapsibleState.Collapsed);
        this.healthChecks = healthChecks.data;
        this.loading = healthChecks.loading;

        this.iconPath = getHealthGroupIcon(this.healthChecks, this.loading);
    }
}
