import * as vscode from 'vscode';
import { PACKAGE_NAME } from '../manifest';
import { HealthCapabilityTreeItem } from './treeItems/healthCapabilityTreeItem';
import { ErrorTreeItem } from './treeItems/errorTreeItem';
import { HostModel } from '../models/hostModel';
import { DisposableCollector } from '../util/disposableCollector';
import { Loadable, loaded } from '../util/loadable';
import { TopoSkillReport } from '../services/topoSkill';
import { LoadingTreeItem } from './treeItems/loadingTreeItem';
import { SkillGroupTreeItem } from './treeItems/skillGroupTreeItem';
import { HealthTreeItem } from './treeItems/healthTreeItem';
import type { HostHealth } from '../util/healthReport';

function getHealthReportItem(health: Loadable<HostHealth>): vscode.TreeItem {
    switch (health.status) {
        case 'loaded':
            return new HealthTreeItem(health);
        case 'errored':
            return new ErrorTreeItem('Failed to load health', health);
        case 'unloaded':
            return new HealthTreeItem(
                loaded({ capabilities: [] }, health.loading),
            );
    }
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
            return [
                getHealthReportItem(this.model.health),
                getSkillReportItem(this.model.skillReport),
            ];
        }

        if (
            element instanceof HealthTreeItem ||
            element instanceof HealthCapabilityTreeItem ||
            element instanceof SkillGroupTreeItem
        ) {
            return element.getChildren();
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
