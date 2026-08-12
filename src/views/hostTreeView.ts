import * as vscode from 'vscode';
import { PACKAGE_NAME } from '../manifest';
import { HealthCheck } from '../services/topoCliSchema';
import { HealthCheckGroupTreeItem } from './treeItems/healthCheckGroupTreeItem';
import { HealthCheckTreeItem } from './treeItems/healthCheckTreeItem';
import { ErrorTreeItem } from './treeItems/errorTreeItem';
import { HostModel } from '../models/hostModel';
import { DisposableCollector } from '../util/disposableCollector';
import { loaded } from '../util/loadable';
import { SkillStatusTreeItem } from './treeItems/skillStatusTreeItem';
import { LoadingTreeItem } from './treeItems/loadingTreeItem';
import { SkillGroupTreeItem } from './treeItems/skillGroupTreeItem';
import {
    TOPO_SKILL_AGENT_LABELS,
    TOPO_SKILL_AGENTS,
} from '../services/topoSkill';

function sortHealthChecksByName(
    healthChecks: readonly HealthCheck[],
): HealthCheck[] {
    return healthChecks.toSorted((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
}

export class HostTreeView
    implements vscode.TreeDataProvider<vscode.TreeItem>, vscode.Disposable
{
    public static readonly viewId = `${PACKAGE_NAME}.host-manager`;

    private readonly disposables = new DisposableCollector();

    private _onDidChangeTreeData = new vscode.EventEmitter<undefined>();
    public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private readonly model: HostModel) {
        const treeView = vscode.window.createTreeView(HostTreeView.viewId, {
            treeDataProvider: this,
            showCollapseAll: false,
        });

        this.disposables.collect(
            treeView,
            this._onDidChangeTreeData,
            this.model.onHealthChanged(() => {
                this._onDidChangeTreeData.fire(undefined);
            }),
            this.model.onSkillStatusesChanged(() => {
                this._onDidChangeTreeData.fire(undefined);
            }),
        );
    }

    public getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
        if (!element) {
            const skillGroupItem = new SkillGroupTreeItem(
                this.model.skillStatuses,
            );

            const health = this.model.health;
            if (health.status === 'errored') {
                return [
                    new ErrorTreeItem('Failed to load health', health),
                    skillGroupItem,
                ];
            }

            const healthChecks =
                health.status === 'loaded'
                    ? sortHealthChecksByName(health.data.host.dependencies)
                    : [];
            return [
                new HealthCheckGroupTreeItem(
                    loaded(healthChecks, health.loading),
                ),
                skillGroupItem,
            ];
        }

        if (element instanceof HealthCheckGroupTreeItem) {
            return element.healthChecks.map(
                (healthCheck) => new HealthCheckTreeItem(loaded(healthCheck)),
            );
        }

        if (element instanceof SkillGroupTreeItem) {
            return TOPO_SKILL_AGENTS.map((agent) => {
                const skillStatus = element.skillStatuses[agent];
                const label = TOPO_SKILL_AGENT_LABELS[agent];
                if (skillStatus.loading) {
                    return new LoadingTreeItem(label);
                }

                switch (skillStatus.status) {
                    case 'loaded':
                        return new SkillStatusTreeItem(agent, skillStatus.data);
                    case 'errored':
                        return new ErrorTreeItem(
                            `Failed to check ${label} skill`,
                            skillStatus,
                        );
                    case 'unloaded':
                        return new LoadingTreeItem(label);
                }
            });
        }

        return [];
    }

    public getTreeItem(
        element: vscode.TreeItem,
    ): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    public dispose(): void {
        this.disposables.dispose();
    }
}
