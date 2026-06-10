import * as vscode from 'vscode';
import { ContainerItem } from '../util/types';

export class TargetProcessingDomainGroupTreeItem extends vscode.TreeItem {
    constructor(
        public readonly target: string,
        public readonly remoteProcessorNames: string[] = [],
        public readonly containers: ContainerItem[] = [],
    ) {
        super('Processing Domains', vscode.TreeItemCollapsibleState.Expanded);
        this.iconPath = new vscode.ThemeIcon('layers');
        this.contextValue = 'ProcessingDomains';
    }
}
