import * as vscode from 'vscode';
import type { TargetItem } from '../util/types';

/** Represents a target */
export class TargetTreeTargetItem extends vscode.TreeItem {
    constructor(
        public readonly target: TargetItem,
        public readonly selected: boolean,
        public readonly connectionReady: boolean,
        public readonly targetReady: boolean,
    ) {
        super(target.ssh, vscode.TreeItemCollapsibleState.Expanded);
        this.id = target.ssh;
        this.iconPath = getTreeItemIcon(selected, connectionReady, targetReady);
        const contextValues = ['Target'];
        if (selected) {
            contextValues.push('Selected');
        }
        if (connectionReady) {
            contextValues.push('ConnectionReady');
        }
        if (targetReady) {
            contextValues.push('TargetReady');
        }
        this.contextValue = contextValues.join(' ');
        this.collapsibleState = getTargetTreeItemState(
            selected,
            connectionReady,
            targetReady,
        );
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
