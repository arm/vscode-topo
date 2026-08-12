import * as vscode from 'vscode';
import { PACKAGE_NAME } from '../manifest';
import { HealthCheck } from '../services/topoCliSchema';
import { HealthCheckGroupTreeItem } from './treeItems/healthCheckGroupTreeItem';
import { HealthCheckTreeItem } from './treeItems/healthCheckTreeItem';
import { ErrorTreeItem } from './treeItems/errorTreeItem';
import { HostModel } from '../models/hostModel';
import { DisposableCollector } from '../util/disposableCollector';
import { Loadable, loaded } from '../util/loadable';
import { TopoSkillReport } from '../services/topoSkill';
import { SkillStatusTreeItem } from './treeItems/skillStatusTreeItem';
import { LoadingTreeItem } from './treeItems/loadingTreeItem';
import { SkillGroupTreeItem } from './treeItems/skillGroupTreeItem';

function sortHealthChecksByName(
    healthChecks: readonly HealthCheck[],
): HealthCheck[] {
    return healthChecks.toSorted((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
}

function getSkillReportItem(
    skillReport: Loadable<TopoSkillReport>,
): vscode.TreeItem {
    if (skillReport.loading) {
        return new LoadingTreeItem('Topo Agent Skill');
    }

    switch (skillReport.status) {
        case 'loaded':
            return new SkillGroupTreeItem(skillReport.data);
        case 'errored':
            return new ErrorTreeItem(
                'Failed to check Topo Agent Skill',
                skillReport,
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
            this.model.onSkillReportChanged(() => {
                this._onDidChangeTreeData.fire(undefined);
            }),
        );
    }

    public getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
        if (!element) {
            const skillReportItem = getSkillReportItem(this.model.skillReport);

            const health = this.model.health;
            if (health.status === 'errored') {
                return [
                    new ErrorTreeItem('Failed to load health', health),
                    skillReportItem,
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
                skillReportItem,
            ];
        }

        if (element instanceof HealthCheckGroupTreeItem) {
            return element.healthChecks.map(
                (healthCheck) => new HealthCheckTreeItem(loaded(healthCheck)),
            );
        }

        if (element instanceof SkillGroupTreeItem) {
            return element.report.agents.map(
                (agent) => new SkillStatusTreeItem(agent),
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
