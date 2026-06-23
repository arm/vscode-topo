import * as vscode from 'vscode';
import { ContainerItem } from '../util/types';

export class ProjectProcessingDomainTreeItem extends vscode.TreeItem {
    constructor(
        public readonly processingDomain: string,
        public readonly containers: ContainerItem[],
    ) {
        super(processingDomain, vscode.TreeItemCollapsibleState.Expanded);
        this.description = `${containers.length} container${containers.length === 1 ? '' : 's'}`;
        this.iconPath = new vscode.ThemeIcon('multiple-windows');
        this.contextValue = `ProjectProcessingDomain ${processingDomain}`;
    }
}
