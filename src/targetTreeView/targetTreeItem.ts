import * as vscode from 'vscode';
import { TargetStatus } from '../util/types';

/** Represents a target */
export class TargetTreeItem extends vscode.TreeItem {
    constructor(
        public readonly target: string,
        public readonly selected: boolean,
        public readonly status: TargetStatus,
    ) {
        super(target, vscode.TreeItemCollapsibleState.Expanded);
        this.id = target;
        this.iconPath = getTargetTreeItemIcon(selected, status);
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
    status: TargetStatus,
): vscode.TreeItemCollapsibleState => {
    if (targetSelected && status === 'connected') {
        return vscode.TreeItemCollapsibleState.Expanded;
    }
    return vscode.TreeItemCollapsibleState.None;
};

export const getTargetTreeItemIcon = (
    targetSelected: boolean,
    status: TargetStatus,
): vscode.ThemeIcon | undefined => {
    if (!targetSelected) {
        return undefined;
    }
    if (status === 'disconnected' && targetSelected) {
        return new vscode.ThemeIcon('loading~spin');
    }
    if (status === 'error') {
        return new vscode.ThemeIcon(
            'error',
            new vscode.ThemeColor('terminal.ansiRed'),
        );
    }
    return undefined;
};
