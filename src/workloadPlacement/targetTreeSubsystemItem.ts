import * as vscode from 'vscode';

export class TargetTreeSubsystemItem extends vscode.TreeItem {
    constructor(
        public readonly group: string,
        public readonly target: string,
    ) {
        super(group, vscode.TreeItemCollapsibleState.Collapsed);
        this.iconPath = new vscode.ThemeIcon('multiple-windows');
        this.contextValue = `Subsystem ${group}`;
    }
}
