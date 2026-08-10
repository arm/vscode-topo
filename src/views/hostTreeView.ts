import * as vscode from 'vscode';
import { PACKAGE_NAME } from '../manifest';
import { HealthCheck } from '../services/topoCliSchema';
import { HealthCheckGroupTreeItem } from './treeItems/healthCheckGroupTreeItem';
import { HealthCheckTreeItem } from './treeItems/healthCheckTreeItem';
import { ErrorTreeItem } from './treeItems/errorTreeItem';
import { HostModel } from '../models/hostModel';
import { DisposableCollector } from '../util/disposableCollector';
import { Loadable, loaded } from '../util/loadable';
import { TopoSkillStatus } from '../util/types';
import { SkillStatusTreeItem } from './treeItems/skillStatusTreeItem';
import { LoadingTreeItem } from './treeItems/loadingTreeItem';

function sortHealthChecksByName(
    healthChecks: readonly HealthCheck[],
): HealthCheck[] {
    return healthChecks.toSorted((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
}

function getSkillStatusItem(
    skillStatus: Loadable<TopoSkillStatus>,
): vscode.TreeItem {
    switch (skillStatus.status) {
        case 'loaded':
            return new SkillStatusTreeItem(skillStatus.data);
        case 'errored':
            return new ErrorTreeItem(
                'Failed to check Topo Agent Skill',
                skillStatus,
            );
        case 'unloaded':
            return new LoadingTreeItem('Topo Agent Skill');
    }
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
            this.model.onSkillStatusChanged(() => {
                this._onDidChangeTreeData.fire(undefined);
            }),
        );
    }

    public getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
        if (!element) {
            const skillStatusItem = getSkillStatusItem(this.model.skillStatus);

            const health = this.model.health;
            if (health.status === 'errored') {
                return [
                    new ErrorTreeItem('Failed to load health', health),
                    skillStatusItem,
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
                skillStatusItem,
            ];
        }

        if (element instanceof HealthCheckGroupTreeItem) {
            return element.healthChecks.map(
                (healthCheck) => new HealthCheckTreeItem(loaded(healthCheck)),
            );
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
