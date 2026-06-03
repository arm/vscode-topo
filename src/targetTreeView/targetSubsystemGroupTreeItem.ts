import * as vscode from 'vscode';
import { ContainerItem } from '../util/types';

export class TargetSubsystemGroupTreeItem extends vscode.TreeItem {
    constructor(
        public readonly target: string,
        public readonly remoteProcessorNames: string[] = [],
        public readonly containers: ContainerItem[] = [],
    ) {
        super('Subsystems', vscode.TreeItemCollapsibleState.Expanded);
        this.iconPath = new vscode.ThemeIcon('layers');
        this.contextValue = 'Subsystems';
    }
}
