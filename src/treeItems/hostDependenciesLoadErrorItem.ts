import * as vscode from 'vscode';
import { DISPLAY_NAME } from '../manifest';
import { showOutput } from '../commands';

export const failedToLoadHostDependenciesMessage =
    'Failed to load host dependencies';

export class HostDependenciesLoadErrorItem extends vscode.TreeItem {
    constructor() {
        super(
            failedToLoadHostDependenciesMessage,
            vscode.TreeItemCollapsibleState.None,
        );
        this.iconPath = new vscode.ThemeIcon(
            'error',
            new vscode.ThemeColor('testing.iconFailed'),
        );
        this.contextValue = 'Dependencies Error';
        this.command = {
            command: showOutput,
            title: `Open ${DISPLAY_NAME} Output`,
        };
        this.tooltip = `Open the ${DISPLAY_NAME} output channel for details.`;
    }
}
