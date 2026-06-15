import * as vscode from 'vscode';
import { Errored } from '../util/loadable';

const targetDataIssueErrorMessage = 'The target data could not be loaded';

export class TargetDataIssueTreeItem extends vscode.TreeItem {
    constructor(errored: Errored) {
        super(
            targetDataIssueErrorMessage,
            vscode.TreeItemCollapsibleState.None,
        );
        this.description = errored.error.message;
        this.tooltip = targetDataIssueErrorMessage;
        this.contextValue = 'DataIssueError OpenableError';
        this.iconPath = new vscode.ThemeIcon(
            errored.loading ? 'loading~spin' : 'error',
            errored.loading
                ? undefined
                : new vscode.ThemeColor('testing.iconFailed'),
        );
    }
}
