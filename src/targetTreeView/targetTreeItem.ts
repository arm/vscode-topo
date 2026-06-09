import * as vscode from 'vscode';
import { IssueCheck, TargetHealthCheck } from '../topoCliSchema';
import { errored, Loadable } from '../util/loadable';
import { getVisibleTargetIssues } from '../target/getVisibleTargetIssues';
import { TargetDescription } from '../util/types';
import { logger } from '../util/logger';
import { hasFixCommand, type FixableHealthIssue } from '../util/issueFixes';

export interface TargetTreeItemOptions {
    readonly target: string;
    readonly selected: boolean;
    readonly health?: Loadable<TargetHealthCheck | undefined>;
    readonly targetDescription?: Loadable<TargetDescription>;
}

const defaultTargetHealth = errored('Target health not available');
const defaultTargetDescription = errored('Target description not available');

/** Represents a target */
export class TargetTreeItem extends vscode.TreeItem {
    public readonly target: string;
    public readonly selected: boolean;
    public readonly health: Loadable<TargetHealthCheck | undefined>;
    public readonly targetDescription: Loadable<TargetDescription>;

    constructor({
        target,
        selected,
        health = defaultTargetHealth,
        targetDescription = defaultTargetDescription,
    }: TargetTreeItemOptions) {
        super(target, vscode.TreeItemCollapsibleState.Expanded);
        this.target = target;
        this.selected = selected;
        this.health = health;
        this.targetDescription = targetDescription;
        this.id = target;
        this.iconPath = getTargetTreeItemIcon(selected, health);

        const contextValues = ['Target'];
        if (selected) {
            contextValues.push('Selected');

            if (this.connected) {
                contextValues.push('Connected');
            } else {
                const message = getConnectivityStatusMessage(health);
                if (message) {
                    logger.warn(message);
                    this.description = message;
                    this.tooltip = `${target}: ${message}`;
                }
            }
        }

        if (this.fixableIssues.length > 0) {
            contextValues.push('HasFixableIssues');
        }
        this.contextValue = contextValues.join(' ');
        this.collapsibleState = getTargetTreeItemState(
            selected,
            this.connected,
        );
    }

    public get connected(): boolean {
        return (
            this.health.status === 'loaded' &&
            this.health.data?.connectivity.status === 'ok'
        );
    }

    public get displayName(): string {
        return this.label?.toString() ?? '';
    }

    public get visibleIssues(): IssueCheck[] {
        if (this.health.status !== 'loaded' || this.health.data === undefined) {
            return [];
        }

        const description =
            this.targetDescription.status === 'loaded'
                ? this.targetDescription.data
                : undefined;
        return getVisibleTargetIssues(this.health.data, description);
    }

    public get fixableIssues(): FixableHealthIssue[] {
        const issues: Array<IssueCheck | undefined> = [...this.visibleIssues];
        if (this.health.status === 'loaded') {
            issues.unshift(this.health.data?.connectivity);
        }

        return issues.filter(hasFixCommand);
    }

    public get remoteProcessorNames(): string[] {
        if (this.targetDescription.status !== 'loaded') {
            return [];
        }
        return this.targetDescription.data.remoteProcessors.map(
            (rp) => rp.name,
        );
    }
}

const getConnectivityStatusMessage = (
    health: Loadable<TargetHealthCheck | undefined>,
): string | undefined => {
    if (health.status === 'errored') {
        return health.error.message;
    }

    if (
        health.status === 'loaded' &&
        health.data?.connectivity.status !== 'ok'
    ) {
        return health.data?.connectivity.value;
    }

    return undefined;
};

const getTargetTreeItemState = (
    targetSelected: boolean,
    connected: boolean,
): vscode.TreeItemCollapsibleState => {
    if (targetSelected && connected) {
        return vscode.TreeItemCollapsibleState.Expanded;
    }
    return vscode.TreeItemCollapsibleState.None;
};

export const getTargetTreeItemIcon = (
    targetSelected: boolean,
    health: Loadable<TargetHealthCheck | undefined>,
): vscode.ThemeIcon | undefined => {
    if (!targetSelected) {
        return undefined;
    }
    if (health.loading) {
        return new vscode.ThemeIcon('loading~spin');
    }
    if (
        health.status === 'errored' ||
        health.data?.connectivity.status !== 'ok'
    ) {
        return new vscode.ThemeIcon(
            'error',
            new vscode.ThemeColor('testing.iconFailed'),
        );
    }
    return undefined;
};
