import * as vscode from 'vscode';
import { Loadable } from '../util/loadable';
import { TargetDescription } from '../util/types';

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
        public readonly targetDescription: Loadable<TargetDescription>,
    ) {
        super('Processing Domains');
        this.collapsibleState = getCollapsibleState(targetDescription);
        this.iconPath = targetDescription.loading
            ? new vscode.ThemeIcon('loading~spin')
            : new vscode.ThemeIcon('layers');
    }
}
