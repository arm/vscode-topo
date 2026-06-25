import * as vscode from 'vscode';
import { ContainerItem } from '../util/types';
import { PRIMARY_PROCESSING_DOMAIN } from '../manifest';

export function compareProcessingDomains(
    a: ProcessingDomainTreeItem,
    b: ProcessingDomainTreeItem,
): number {
    if (a.processingDomain === PRIMARY_PROCESSING_DOMAIN) {
        return -1;
    }
    if (b.processingDomain === PRIMARY_PROCESSING_DOMAIN) {
        return 1;
    }

    return a.processingDomain.localeCompare(b.processingDomain, undefined, {
        sensitivity: 'base',
    });
}

export class ProcessingDomainTreeItem extends vscode.TreeItem {
    constructor(
        public readonly processingDomain: string,
        public readonly containers?: ContainerItem[],
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
}
