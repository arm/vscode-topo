import * as vscode from 'vscode';
import { Errored } from '../../util/loadable';
import { getErrorMessage } from '../../util/getErrorMessage';

export class ErrorTreeItem extends vscode.TreeItem {
    constructor(label: string, errored?: Errored) {
        super(label, vscode.TreeItemCollapsibleState.None);
        if (errored) {
            const message = getErrorMessage(errored.error);
            this.description = message;
            this.tooltip = `${label}: ${message}`;
        }
        this.iconPath = new vscode.ThemeIcon(
            'error',
            new vscode.ThemeColor('testing.iconFailed'),
        );
        if (errored?.loading) {
            this.iconPath = new vscode.ThemeIcon('loading~spin');
        }
        this.contextValue = 'OpenableError';
    }
}
