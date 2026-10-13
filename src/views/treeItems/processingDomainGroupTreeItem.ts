import * as vscode from 'vscode';
import { Loadable } from '../../util/loadable';
import { TargetDescription } from '../../services/topoCliSchema';
import { PRIMARY_PROCESSING_DOMAIN } from '../../manifest';
import { ErrorTreeItem } from './errorTreeItem';
import { ProcessingDomainTreeItem } from './processingDomainTreeItem';
import { compareProcessingDomains } from '../util/compareProcessingDomains';

function getCollapsibleState(
    targetDescription: Loadable<TargetDescription>,
): vscode.TreeItemCollapsibleState {
    if (targetDescription.status === 'errored') {
        return vscode.TreeItemCollapsibleState.Expanded;
    }

    return vscode.TreeItemCollapsibleState.Collapsed;
}

export class ProcessingDomainGroupTreeItem extends vscode.TreeItem {
    constructor(
        private readonly targetDescription: Loadable<TargetDescription>,
    ) {
        super('Processing Domains');
        this.collapsibleState = getCollapsibleState(targetDescription);
        this.iconPath = targetDescription.loading
            ? new vscode.ThemeIcon('loading~spin')
            : new vscode.ThemeIcon('layers');
    }

    public getChildren(): vscode.TreeItem[] {
        const targetDescription = this.targetDescription;
        if (targetDescription.status === 'errored') {
            return [
                new ErrorTreeItem(
                    'Failed to load processing domains',
                    targetDescription,
                ),
            ];
        }

        if (targetDescription.status === 'unloaded') {
            return [];
        }

        const processingDomains = [
            PRIMARY_PROCESSING_DOMAIN,
            ...targetDescription.data.remoteProcessors.map(
                (remoteProcessor) => remoteProcessor.name,
            ),
        ];

        return processingDomains
            .sort(compareProcessingDomains)
            .map((processingDomain) => {
                return new ProcessingDomainTreeItem(processingDomain);
            });
    }
}
