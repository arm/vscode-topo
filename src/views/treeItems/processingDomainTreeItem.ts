import * as vscode from 'vscode';
import { ContainerItem } from '../../util/types';
import { ContainerTreeItem } from './containerTreeItem';

function compareContainers(a: ContainerItem, b: ContainerItem): number {
    if (a.state === 'running' && b.state !== 'running') {
        return -1;
    }
    if (a.state !== 'running' && b.state === 'running') {
        return 1;
    }
    return a.names.localeCompare(b.names, undefined, { sensitivity: 'base' });
}

export class ProcessingDomainTreeItem extends vscode.TreeItem {
    constructor(
        processingDomain: string,
        private readonly containers?: readonly ContainerItem[],
    ) {
        super(
            processingDomain,
            containers === undefined
                ? vscode.TreeItemCollapsibleState.None
                : vscode.TreeItemCollapsibleState.Expanded,
        );
        if (containers !== undefined) {
            this.description = `${containers.length} container${containers.length === 1 ? '' : 's'}`;
        }
        this.iconPath = new vscode.ThemeIcon('multiple-windows');
        this.contextValue = `ProcessingDomain ${processingDomain}`;
    }

    public getChildren(): ContainerTreeItem[] {
        return (this.containers ?? [])
            .toSorted(compareContainers)
            .map((container) => new ContainerTreeItem(container));
    }
}
