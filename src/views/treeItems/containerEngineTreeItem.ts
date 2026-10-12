import * as vscode from 'vscode';
import type { ContainerEngine } from '../../util/resolveContainerEngine';

export class ContainerEngineTreeItem extends vscode.TreeItem {
    constructor(containerEngine: ContainerEngine) {
        super('Container Engine', vscode.TreeItemCollapsibleState.None);
        this.id = 'containerEngine';
        this.description = containerEngine;
        this.tooltip = `Container engine: ${containerEngine}. Set by topo.containerEngine; Auto uses TOPO_ENGINE (Docker when unset).`;
        this.iconPath = new vscode.ThemeIcon('package');
    }
}
