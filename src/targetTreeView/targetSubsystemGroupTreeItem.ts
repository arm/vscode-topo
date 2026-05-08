import * as vscode from 'vscode';

export class TargetSubsystemGroupTreeItem extends vscode.TreeItem {
    constructor(public readonly target: string) {
        super('Subsystems', vscode.TreeItemCollapsibleState.Expanded);
        this.iconPath = new vscode.ThemeIcon('layers');
        this.contextValue = 'Subsystems';
    }
}
