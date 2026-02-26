import * as vscode from 'vscode';

/** Represents a subsystem of the target (e.g. Host or a remote processor) */

export class TargetTreeSubsystemItem extends vscode.TreeItem {
    constructor(public readonly group: string) {
        super(group, vscode.TreeItemCollapsibleState.Collapsed);
        this.iconPath = new vscode.ThemeIcon('multiple-windows');
        this.contextValue = `Subsystem ${group}`;
    }
}
