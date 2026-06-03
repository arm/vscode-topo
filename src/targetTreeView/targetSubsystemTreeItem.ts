import * as vscode from 'vscode';
import { ContainerItem } from '../util/types';

export class TargetSubsystemTreeItem extends vscode.TreeItem {
    constructor(
        public readonly group: string,
        public readonly target: string,
        public readonly containers: ContainerItem[] = [],
    ) {
        super(group, vscode.TreeItemCollapsibleState.Collapsed);
        this.iconPath = new vscode.ThemeIcon('multiple-windows');
        this.contextValue = `Subsystem ${group}`;
    }
}
