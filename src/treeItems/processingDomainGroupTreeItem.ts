import * as vscode from 'vscode';
import { ContainerItem } from '../util/types';
import { Loadable } from '../util/loadable';

function describeContainerCount(
    containers: Loadable<ContainerItem[]>,
): string | undefined {
    if (containers.status !== 'loaded') {
        return undefined;
    }

    return `${containers.data.length} container${containers.data.length === 1 ? '' : 's'}`;
}

export class ProcessingDomainGroupTreeItem extends vscode.TreeItem {
    constructor(
        public readonly target: string,
        public readonly remoteProcessorNames: string[],
        public readonly containers: Loadable<ContainerItem[]>,
    ) {
        super('Processing Domains', vscode.TreeItemCollapsibleState.Expanded);
        this.description = describeContainerCount(containers);
        this.iconPath = new vscode.ThemeIcon('layers');
        if (containers.loading) {
            this.iconPath = new vscode.ThemeIcon('loading~spin');
        }
        this.contextValue = 'ProcessingDomains';
    }
}
