import * as vscode from 'vscode';
import { CONTEXT_PROJECT_COUNT, PACKAGE_NAME } from '../manifest';
import { ProjectTreeItem } from './treeItems/projectTreeItem';
import { DisposableCollector } from '../util/disposableCollector';
import { ProjectModel } from '../models/projectModel';
import { ErrorTreeItem } from './treeItems/errorTreeItem';
import { LoadingTreeItem } from './treeItems/loadingTreeItem';
import { Loadable } from '../util/loadable';
import { ProjectMetadata } from '../util/project';
import { ContainerTreeItem } from './treeItems/containerTreeItem';
import { ContainerItem } from '../util/types';
import {
    compareProcessingDomains,
    ProcessingDomainTreeItem,
} from './treeItems/processingDomainTreeItem';

function syncProjectCountContext(projects: Loadable<ProjectMetadata[]>): void {
    const count =
        projects.status === 'loaded' ? projects.data.length : undefined;
    void vscode.commands.executeCommand(
        'setContext',
        CONTEXT_PROJECT_COUNT,
        count,
    );
}

function compareContainers(a: ContainerItem, b: ContainerItem): number {
    if (a.state === 'running' && b.state !== 'running') {
        return -1;
    }
    if (a.state !== 'running' && b.state === 'running') {
        return 1;
    }
    return a.names.localeCompare(b.names, undefined, { sensitivity: 'base' });
}

function groupContainersByProcessingDomain(
    containers: ContainerItem[],
): ProcessingDomainTreeItem[] {
    const containersByDomain = new Map<string, ContainerItem[]>();
    for (const container of containers) {
        const domain = container.processingDomain || 'Unknown';
        containersByDomain.set(domain, [
            ...(containersByDomain.get(domain) ?? []),
            container,
        ]);
    }

    return [...containersByDomain.entries()]
        .map(([domain, containers]) => {
            const sortedContainers = [...containers].sort(compareContainers);
            return new ProcessingDomainTreeItem(domain, sortedContainers);
        })
        .sort(compareProcessingDomains);
}

function getProjectChildren(projectItem: ProjectTreeItem): vscode.TreeItem[] {
    const containers = projectItem.containers;

    if (containers.status === 'errored') {
        return [new ErrorTreeItem('Failed to load containers', containers)];
    }

    if (containers.status === 'unloaded') {
        return [];
    }

    return groupContainersByProcessingDomain(containers.data);
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
            this.model.onProjectContainersChanged(() => {
                this._onDidChangeTreeData.fire(undefined);
            }),
        );
    }

    public getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
        if (!element) {
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
            return projects.data.map((project) => {
                const containers = this.model.getProjectContainers(project);
                return new ProjectTreeItem(
                    project,
                    showWorkspaceName,
                    containers,
                );
            });
        }

        if (element instanceof ProjectTreeItem) {
            return getProjectChildren(element);
        }

        if (element instanceof ProcessingDomainTreeItem) {
            return (element.containers ?? []).map(
                (container) => new ContainerTreeItem(container),
            );
        }

        return [];
    }

    public getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    public dispose(): void {
        this.disposables.dispose();
    }
}
