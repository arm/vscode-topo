import * as vscode from 'vscode';
import { TargetDestination } from '../util/types';

export class TargetTreeSubsystemGroupItem extends vscode.TreeItem {
    constructor(public readonly target: TargetDestination) {
        super('Subsystems', vscode.TreeItemCollapsibleState.Expanded);
        this.iconPath = new vscode.ThemeIcon('layers');
        this.contextValue = 'Subsystems';
    }
}
