import * as vscode from 'vscode';
import { ProjectMetadata } from '../util/project';

export class ProjectTreeItem extends vscode.TreeItem {
    public readonly composeFileUri: vscode.Uri;

    constructor(project: ProjectMetadata, showWorkspaceName: boolean) {
        super(project.name, vscode.TreeItemCollapsibleState.None);
        this.composeFileUri = project.composeFileUri;
        this.tooltip = project.uri.fsPath;
        this.description = showWorkspaceName
            ? project.workspaceName
            : undefined;
        this.iconPath = new vscode.ThemeIcon('folder');
        this.contextValue = 'Project';
    }
}
