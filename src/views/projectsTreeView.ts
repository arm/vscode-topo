import * as vscode from 'vscode';
import { CONTEXT_PROJECT_COUNT, PACKAGE_NAME } from '../manifest';
import { ProjectTreeItem } from '../treeItems/projectTreeItem';
import { DisposableCollector } from '../util/disposableCollector';
import { ProjectModel } from '../models/projectModel';
import { ErrorTreeItem } from '../treeItems/errorTreeItem';
import { LoadingTreeItem } from '../treeItems/loadingTreeItem';
import { Loadable } from '../util/loadable';
import { ProjectMetadata } from '../util/project';

function syncProjectCountContext(projects: Loadable<ProjectMetadata[]>): void {
    const count =
        projects.status === 'loaded' ? projects.data.length : undefined;
    void vscode.commands.executeCommand(
        'setContext',
        CONTEXT_PROJECT_COUNT,
        count,
    );
}

export class ProjectsTreeView
    implements vscode.TreeDataProvider<vscode.TreeItem>, vscode.Disposable
{
    public static readonly viewId = `${PACKAGE_NAME}.projects`;

    private readonly disposables = new DisposableCollector();

    private _onDidChangeTreeData = new vscode.EventEmitter<undefined>();
    public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private readonly model: ProjectModel) {
        const treeView = vscode.window.createTreeView(ProjectsTreeView.viewId, {
            treeDataProvider: this,
            showCollapseAll: false,
        });
        syncProjectCountContext(this.model.projects);

        this.disposables.collect(
            treeView,
            this._onDidChangeTreeData,
            this.model.onProjectsChanged(() => {
                syncProjectCountContext(this.model.projects);
                this._onDidChangeTreeData.fire(undefined);
            }),
        );
    }

    public getChildren(element?: ProjectTreeItem): vscode.TreeItem[] {
        if (element) {
            return [];
        }

        const projects = this.model.projects;
        if (projects.status === 'errored') {
            return [new ErrorTreeItem('Failed to load projects', projects)];
        }

        if (projects.status === 'unloaded') {
            return [];
        }

        if (projects.loading) {
            return [new LoadingTreeItem('Loading projects')];
        }

        const showWorkspaceName =
            (vscode.workspace.workspaceFolders?.length ?? 0) > 1;
        return projects.data.map(
            (project) => new ProjectTreeItem(project, showWorkspaceName),
        );
    }

    public getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    public dispose(): void {
        this.disposables.dispose();
    }
}
