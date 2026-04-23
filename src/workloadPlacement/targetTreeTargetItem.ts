import * as vscode from 'vscode';
import { TargetConnectionStatus, TargetItem } from '../util/types';

/** Represents a target */
export class TargetTreeTargetItem extends vscode.TreeItem {
    constructor(
        public readonly target: TargetItem,
        public readonly selected: boolean,
        public readonly status: TargetConnectionStatus,
    ) {
        super(target.ssh, vscode.TreeItemCollapsibleState.Expanded);
        this.id = target.ssh;
        this.iconPath = getTreeItemIcon(selected, status);
        const contextValues = ['Target'];
        if (selected) {
            contextValues.push('Selected');
        }
        if (status === 'connected') {
            contextValues.push('Connected');
        }
        this.contextValue = contextValues.join(' ');
        this.collapsibleState = getTargetTreeItemState(selected, status);
    }

    public get displayName(): string {
        return this.label?.toString() ?? '';
    }
}

export const getTargetTreeItemState = (
    targetSelected: boolean,
    status: TargetConnectionStatus,
): vscode.TreeItemCollapsibleState => {
    if (targetSelected && status === 'connected') {
        return vscode.TreeItemCollapsibleState.Expanded;
    }
    return vscode.TreeItemCollapsibleState.None;
};

export const getTreeItemIcon = (
    targetSelected: boolean,
    status: TargetConnectionStatus,
): vscode.ThemeIcon | undefined => {
    if (!targetSelected) {
        return undefined;
    }
    if (status === 'connecting') {
        return new vscode.ThemeIcon('loading~spin');
    }
    if (status === 'disconnected') {
        return new vscode.ThemeIcon(
            'error',
            new vscode.ThemeColor('terminal.ansiRed'),
        );
    }
    return undefined;
};
