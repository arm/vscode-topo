import * as vscode from 'vscode';

export class LoadingTreeItem extends vscode.TreeItem {
    constructor(label: string) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon('loading~spin');
    }
}
