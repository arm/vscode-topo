import * as vscode from 'vscode';
import { ProjectMetadata } from '../../util/project';
import { Loadable } from '../../util/loadable';
import { ContainerItem } from '../../util/types';
import { ErrorTreeItem } from './errorTreeItem';
import { ProcessingDomainTreeItem } from './processingDomainTreeItem';
import { compareProcessingDomains } from '../util/compareProcessingDomains';

function groupContainersByProcessingDomain(
    containers: readonly ContainerItem[],
): ProcessingDomainTreeItem[] {
    const containersByDomain = Map.groupBy(
        containers,
        (container) => container.processingDomain || 'Unknown',
    );

    return [...containersByDomain.entries()]
        .sort(([a], [b]) => compareProcessingDomains(a, b))
        .map(([domain, containers]) => {
            return new ProcessingDomainTreeItem(domain, containers);
        });
}

function getCollapsibleState(
    containers: Loadable<ContainerItem[]>,
): vscode.TreeItemCollapsibleState {
    if (containers.status === 'loaded') {
        return containers.data.length > 0
            ? vscode.TreeItemCollapsibleState.Expanded
            : vscode.TreeItemCollapsibleState.None;
    }

    if (containers.status === 'errored') {
        return vscode.TreeItemCollapsibleState.Expanded;
    }

    return vscode.TreeItemCollapsibleState.None;
}

export class ProjectTreeItem extends vscode.TreeItem {
    public readonly composeFileUri: vscode.Uri;

    constructor(
        project: ProjectMetadata,
        showWorkspaceName: boolean,
        private readonly containers: Loadable<ContainerItem[]>,
    ) {
        super(project.name, getCollapsibleState(containers));
        this.composeFileUri = project.composeFileUri;
        this.tooltip = project.uri.fsPath;
        this.description = showWorkspaceName
            ? project.workspaceName
            : undefined;
        this.iconPath = containers.loading
            ? new vscode.ThemeIcon('loading~spin')
            : new vscode.ThemeIcon('folder');
        this.contextValue = 'Project';
    }

    public getChildren(): vscode.TreeItem[] {
        const containers = this.containers;

        if (containers.status === 'errored') {
            return [new ErrorTreeItem('Failed to load containers', containers)];
        }

        if (containers.status === 'unloaded') {
            return [];
        }

        return groupContainersByProcessingDomain(containers.data);
    }
}
