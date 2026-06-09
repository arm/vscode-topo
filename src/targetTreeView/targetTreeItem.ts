import * as vscode from 'vscode';
import { getFixableDependencyFixes } from '../util/getDependencyFixes';
import {
    HealthCheckDependency,
    TargetHealthCheckResult,
} from '../topoCliSchema';
import { errored, Loadable, loaded } from '../util/loadable';
import { getVisibleTargetDependencies } from '../target/getVisibleTargetDependencies';
import { ContainerItem, TargetDescription } from '../util/types';

export interface TargetTreeItemOptions {
    readonly target: string;
    readonly selected: boolean;
    readonly health?: Loadable<TargetHealthCheckResult | undefined>;
    readonly targetDescription?: Loadable<TargetDescription>;
    readonly containers?: Loadable<ContainerItem[]>;
}

const defaultTargetHealth = errored('Target health not available');
const defaultTargetDescription = errored('Target description not available');
const defaultContainers = loaded([]);

/** Represents a target */
export class TargetTreeItem extends vscode.TreeItem {
    public readonly target: string;
    public readonly selected: boolean;
    public readonly health: Loadable<TargetHealthCheckResult | undefined>;
    public readonly targetDescription: Loadable<TargetDescription>;

    constructor({
        target,
        selected,
        health = defaultTargetHealth,
        targetDescription = defaultTargetDescription,
        containers = defaultContainers,
    }: TargetTreeItemOptions) {
        super(target, vscode.TreeItemCollapsibleState.Expanded);
        this.target = target;
        this.selected = selected;
        this.health = health;
        this.targetDescription = targetDescription;
        this.id = target;
        if (selected && health.status === 'errored') {
            this.description = health.error.message;
            this.tooltip = `${target}: ${health.error.message}`;
        }
        const loadables = [health, targetDescription, containers];
        this.iconPath = getTargetTreeItemIcon(selected, ...loadables);
        const contextValues = ['Target'];
        if (selected) {
            contextValues.push('Selected');
        }
        if (health.status === 'loaded' && health.data !== undefined) {
            contextValues.push('Connected');
        }
        if (getFixableDependencyFixes(this.visibleDependencies).length > 0) {
            contextValues.push('HasFixableDependencies');
        }
        this.contextValue = contextValues.join(' ');
        this.collapsibleState = getTargetTreeItemState(selected, health);
    }

    public get displayName(): string {
        return this.label?.toString() ?? '';
    }

    public get visibleDependencies(): HealthCheckDependency[] {
        if (this.health.status !== 'loaded' || this.health.data === undefined) {
            return [];
        }

        const description =
            this.targetDescription.status === 'loaded'
                ? this.targetDescription.data
                : undefined;
        return getVisibleTargetDependencies(this.health.data, description);
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

export const getTargetTreeItemState = (
    targetSelected: boolean,
    health: Loadable<unknown>,
): vscode.TreeItemCollapsibleState => {
    if (targetSelected && health.status === 'loaded' && health.data) {
        return vscode.TreeItemCollapsibleState.Expanded;
    }
    return vscode.TreeItemCollapsibleState.None;
};

export const getTargetTreeItemIcon = (
    targetSelected: boolean,
    ...loadables: Loadable<unknown>[]
): vscode.ThemeIcon | undefined => {
    if (!targetSelected) {
        return undefined;
    }
    if (loadables.some((l) => l.loading)) {
        return new vscode.ThemeIcon('loading~spin');
    }
    if (loadables.some((l) => l.status === 'errored')) {
        return new vscode.ThemeIcon(
            'error',
            new vscode.ThemeColor('testing.iconFailed'),
        );
    }
    return undefined;
};
