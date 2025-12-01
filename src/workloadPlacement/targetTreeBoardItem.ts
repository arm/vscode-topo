import * as vscode from 'vscode';
import { Target } from './target';

/** Represents a board */
export class TargetTreeBoardItem extends vscode.TreeItem {

    constructor(
        target: Target,
        public readonly selected: boolean,
        public readonly connectionReady: boolean,
        public readonly targetReady: boolean
    ) {
        super(target.id, vscode.TreeItemCollapsibleState.Expanded);
        this.id = target.id;
        this.description = target.ssh;
        this.iconPath = this.getTreeItemIcon();
        const contextValues = ['Board'];
        if (this.selected) {
            contextValues.push('Selected');
        }
        if (this.connectionReady) {
            contextValues.push('ConnectionReady');
        }
        if (this.targetReady) {
            contextValues.push('TargetReady');
        }
        this.contextValue = contextValues.join(' ');
        this.collapsibleState = this.getTreeItemState();
    }

    public get displayName(): string {
        return this.label?.toString() ?? '';
    }

    private getTreeItemState(): vscode.TreeItemCollapsibleState {
        if (this.selected && !this.connectionReady) {
            return vscode.TreeItemCollapsibleState.None;
        }
        if (!this.targetReady) {
            return vscode.TreeItemCollapsibleState.None;
        }
        return this.selected ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None;
    }

    private getTreeItemIcon(): string | vscode.IconPath | undefined {
        if (this.selected && !this.connectionReady) {
            return new vscode.ThemeIcon('loading~spin');
        }
        if (!this.targetReady) {
            return this.selected ? new vscode.ThemeIcon('error', new vscode.ThemeColor('terminal.ansiRed')) : undefined;
        }
        return undefined;
    }
}
