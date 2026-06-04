import * as vscode from 'vscode';
import { DISPLAY_NAME } from '../manifest';
import { showOutput } from '../commands';

export class ErrorTreeItem extends vscode.TreeItem {
    constructor(message: string, description?: string) {
        super(message, vscode.TreeItemCollapsibleState.None);
        this.description = description;
        this.iconPath = new vscode.ThemeIcon(
            'error',
            new vscode.ThemeColor('testing.iconFailed'),
        );
        this.contextValue = 'OpenableError';
        this.command = {
            command: showOutput,
            title: `Open ${DISPLAY_NAME} Output`,
        };
        this.tooltip = `Open the ${DISPLAY_NAME} output channel for details.`;
    }
}
