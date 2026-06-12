import * as vscode from 'vscode';
import { Errored } from '../util/loadable';

const corruptedDataMessage = 'The local data saved by Topo looks corrupted.';

export class TargetDataIssueTreeItem extends vscode.TreeItem {
    constructor(errored: Errored) {
        super('Local data issue', vscode.TreeItemCollapsibleState.None);
        this.description = errored.error.message;
        this.tooltip = corruptedDataMessage;
        this.contextValue = 'CorruptedDataIssue OpenableError';
        this.iconPath = new vscode.ThemeIcon(
            errored.loading ? 'loading~spin' : 'error',
            errored.loading
                ? undefined
                : new vscode.ThemeColor('testing.iconFailed'),
        );
    }
}
