import * as vscode from 'vscode';
import { TargetDescription } from '../util/types';

export class TargetSubsystemGroupTreeItem extends vscode.TreeItem {
    constructor(
        public readonly target: string,
        public readonly targetDescription: TargetDescription | undefined,
    ) {
        super('Subsystems', vscode.TreeItemCollapsibleState.Expanded);
        this.iconPath = new vscode.ThemeIcon('layers');
        this.contextValue = 'Subsystems';
    }
}
