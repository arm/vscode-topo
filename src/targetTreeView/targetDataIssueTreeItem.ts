import * as vscode from 'vscode';

export const corruptedDataMessage =
    'The local data saved by Topo looks corrupted.';

export class TargetDataIssueTreeItem extends vscode.TreeItem {
    constructor() {
        super('Local data issue', vscode.TreeItemCollapsibleState.None);
        this.description = corruptedDataMessage;
        this.tooltip = corruptedDataMessage;
        this.contextValue = 'CorruptedDataIssue';
        this.iconPath = new vscode.ThemeIcon(
            'error',
            new vscode.ThemeColor('testing.iconFailed'),
        );
    }
}
