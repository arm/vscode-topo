import * as vscode from 'vscode';
import type { TargetItem } from '../util/types';

/** Represents a board */
export class TargetTreeBoardItem extends vscode.TreeItem {
    public readonly targetId: string;

    constructor(
        target: TargetItem,
        public readonly selected: boolean,
        public readonly connectionReady: boolean,
        public readonly targetReady: boolean,
    ) {
        super(target.id, vscode.TreeItemCollapsibleState.Expanded);
        this.id = target.id;
        this.description = target.ssh;
        this.iconPath = getTreeItemIcon(
            this.selected,
            this.connectionReady,
            this.targetReady,
        );
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
        this.collapsibleState = getTargetTreeItemState(
            this.selected,
            this.connectionReady,
            this.targetReady,
        );
        this.targetId = target.id;
    }

    public get displayName(): string {
        return this.label?.toString() ?? '';
    }
}

export const getTargetTreeItemState = (
    targetSelected: boolean,
    connectionReady: boolean,
    targetReady: boolean,
): vscode.TreeItemCollapsibleState => {
    if (targetSelected && connectionReady && targetReady) {
        return vscode.TreeItemCollapsibleState.Expanded;
    }
    return vscode.TreeItemCollapsibleState.None;
};

export const getTreeItemIcon = (
    targetSelected: boolean,
    connectionReady: boolean,
    targetReady: boolean,
): vscode.ThemeIcon | undefined => {
    if (!targetSelected) {
        return undefined;
    }
    if (!connectionReady) {
        return new vscode.ThemeIcon('loading~spin');
    }
    if (!targetReady) {
        return new vscode.ThemeIcon(
            'error',
            new vscode.ThemeColor('terminal.ansiRed'),
        );
    }
    return undefined;
};
