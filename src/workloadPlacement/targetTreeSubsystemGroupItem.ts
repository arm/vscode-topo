import * as vscode from 'vscode';
import { TargetItem } from '../util/types';

export class TargetTreeSubsystemGroupItem extends vscode.TreeItem {
    constructor(public readonly target: TargetItem) {
        super('Subsystems', vscode.TreeItemCollapsibleState.Expanded);
        this.iconPath = new vscode.ThemeIcon('layers');
        this.contextValue = 'Subsystems';
    }
}
