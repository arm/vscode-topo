import * as vscode from 'vscode';
import { TargetDescription, TargetState, TargetStatus } from '../util/types';
import { getFixableDependencyFixes } from '../util/getDependencyFixes';
import { HealthCheckDependency } from '../topoCliSchema';
import { getVisibleTargetDependencies } from '../target/getVisibleTargetDependencies';

/** Represents a target */
export class TargetTreeItem extends vscode.TreeItem {
    public readonly visibleDependencies: HealthCheckDependency[];

    constructor(
        public readonly target: string,
        public readonly selected: boolean,
        public readonly state: TargetState,
        public readonly targetDescription: TargetDescription | undefined,
    ) {
        super(target, vscode.TreeItemCollapsibleState.Expanded);
        this.id = target;
        this.iconPath = getTargetTreeItemIcon(selected, state.status);
        this.visibleDependencies = state.health
            ? getVisibleTargetDependencies(state.health, targetDescription)
            : [];
        const contextValues = ['Target'];
        if (selected) {
            contextValues.push('Selected');
        }
        if (state.status === 'connected') {
            contextValues.push('Connected');
        }
        if (getFixableDependencyFixes(this.visibleDependencies).length > 0) {
            contextValues.push('HasFixableDependencies');
        }
        this.contextValue = contextValues.join(' ');
        this.collapsibleState = getTargetTreeItemState(selected, state.status);
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
