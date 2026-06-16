import * as vscode from 'vscode';
import { ContainerItem } from '../util/types';
import { Loadable } from '../util/loadable';

export class TargetProcessingDomainGroupTreeItem extends vscode.TreeItem {
    constructor(
        public readonly target: string,
        public readonly remoteProcessorNames: string[],
        public readonly containers: Loadable<ContainerItem[]>,
    ) {
        super('Processing Domains', vscode.TreeItemCollapsibleState.Expanded);
        this.iconPath = new vscode.ThemeIcon('layers');
        if (containers.loading) {
            this.iconPath = new vscode.ThemeIcon('loading~spin');
        }
        this.contextValue = 'ProcessingDomains';
    }
}
