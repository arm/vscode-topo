import * as vscode from 'vscode';
import type { ContainerEngine } from '../../util/resolveContainerEngine';

export class ContainerEngineTreeItem extends vscode.TreeItem {
    constructor(containerEngine: ContainerEngine) {
        super('Container Engine', vscode.TreeItemCollapsibleState.None);
        this.id = 'containerEngine';
        this.description = containerEngine;
        this.tooltip = `Container engine from TOPO_ENGINE (Docker when unset): ${containerEngine}`;
        this.iconPath = new vscode.ThemeIcon('package');
    }
}
