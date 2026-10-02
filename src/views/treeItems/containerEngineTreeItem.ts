import * as vscode from 'vscode';
import type { ContainerEngine } from '../../manifest';

export class ContainerEngineTreeItem extends vscode.TreeItem {
    constructor(engine: ContainerEngine) {
        super('Container Engine', vscode.TreeItemCollapsibleState.None);
        this.id = 'containerEngine';
        this.description = engine;
        this.iconPath = new vscode.ThemeIcon('package');
        this.tooltip = `Container engine used by Topo: ${engine}`;
        this.contextValue = 'ContainerEngine';
    }
}
