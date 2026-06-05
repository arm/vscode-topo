import * as vscode from 'vscode';
import { ContainerItem } from '../util/types';
import { Loadable, loaded } from '../util/loadable';

export class TargetSubsystemGroupTreeItem extends vscode.TreeItem {
    constructor(
        public readonly target: string,
        public readonly remoteProcessorNames: string[] = [],
        public readonly containers: Loadable<ContainerItem[]> = loaded([]),
    ) {
        super('Subsystems', vscode.TreeItemCollapsibleState.Expanded);
        this.iconPath = new vscode.ThemeIcon('layers');
        if (containers.loading) {
            this.iconPath = new vscode.ThemeIcon('loading~spin');
        }
        this.contextValue = 'Subsystems';
    }
}
