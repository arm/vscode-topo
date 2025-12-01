import * as vscode from 'vscode';

/** Represents a subsystem of the target (Host or Ambient) */

export class TargetTreeSubsystemItem extends vscode.TreeItem {
    constructor(
        public readonly group: 'Host' | 'Ambient'
    ) {
        super(group, vscode.TreeItemCollapsibleState.Collapsed);
        this.iconPath = new vscode.ThemeIcon('multiple-windows');
        this.contextValue = `Subsystem ${group}`;
    }
}
