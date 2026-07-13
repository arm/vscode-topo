import * as vscode from 'vscode';
import { ProjectMetadata } from '../../util/project';
import { Loadable } from '../../util/loadable';
import { ContainerItem } from '../../util/types';

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
    constructor(
        public readonly project: ProjectMetadata,
        showWorkspaceName: boolean,
        public readonly containers: Loadable<ContainerItem[]>,
    ) {
        super(project.name, getCollapsibleState(containers));
        this.tooltip = project.uri.fsPath;
        this.description = showWorkspaceName
            ? project.workspaceName
            : undefined;
        this.iconPath = containers.loading
            ? new vscode.ThemeIcon('loading~spin')
            : new vscode.ThemeIcon('folder');
        this.contextValue = 'Project';
    }
}
