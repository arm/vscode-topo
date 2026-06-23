import * as vscode from 'vscode';
import { ContainerItem } from '../util/types';

export class ProcessingDomainTreeItem extends vscode.TreeItem {
    constructor(
        public readonly processingDomainId: string,
        public readonly target: string,
        public readonly containers: ContainerItem[] = [],
        displayName = processingDomainId,
    ) {
        super(displayName, vscode.TreeItemCollapsibleState.Collapsed);
        this.iconPath = new vscode.ThemeIcon('multiple-windows');
        this.contextValue = `ProcessingDomain ${processingDomainId}`;
    }
}
