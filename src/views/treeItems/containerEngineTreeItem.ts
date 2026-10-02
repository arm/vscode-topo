import * as vscode from 'vscode';
import type { ContainerEngine } from '../../manifest';

export class ContainerEngineTreeItem extends vscode.TreeItem {
    constructor(containerEngine: ContainerEngine) {
        super('Container Engine', vscode.TreeItemCollapsibleState.None);
        this.id = 'containerEngine';
        this.description = containerEngine;
        this.tooltip = `Container engine used by Topo: ${containerEngine}`;
        this.iconPath = new vscode.ThemeIcon('package');
        this.contextValue = 'ContainerEngine';
    }
}
