import * as vscode from 'vscode';
import { DISPLAY_NAME } from '../../manifest';
import { showOutput } from '../../commands';
import { Errored } from '../../util/loadable';

export class ErrorTreeItem extends vscode.TreeItem {
    constructor(label: string, errored?: Errored) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.description = errored?.error.message;
        this.iconPath = new vscode.ThemeIcon(
            'error',
            new vscode.ThemeColor('testing.iconFailed'),
        );
        if (errored?.loading) {
            this.iconPath = new vscode.ThemeIcon('loading~spin');
        }
        this.contextValue = 'OpenableError';
        this.command = {
            command: showOutput,
            title: `Open ${DISPLAY_NAME} Output`,
        };
        this.tooltip = `Open the ${DISPLAY_NAME} output channel for details.`;
    }
}
