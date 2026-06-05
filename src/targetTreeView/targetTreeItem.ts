import * as vscode from 'vscode';
import { TargetStatus } from '../util/types';
import {
    hasFixableIssueFix,
    type FixableHealthCheckIssue,
} from '../util/getIssueFixes';
import { HealthCheckDependency } from '../topoCliSchema';
import { HealthCheckDependencyGroupTreeItem } from '../treeItems/healthCheckDependencyGroupTreeItem';
import { TargetSubsystemGroupTreeItem } from './targetSubsystemGroupTreeItem';
import { ContainerItem } from '../util/types';

function getConnectivityDiagnosticsMessage(
    selected: boolean,
    connectivityCheck?: HealthCheckDependency,
): string | undefined {
    if (
        !selected ||
        connectivityCheck?.status === 'ok' ||
        !connectivityCheck?.value
    ) {
        return undefined;
    }

    return connectivityCheck.value;
}

/** Represents a target */
export class TargetTreeItem extends vscode.TreeItem {
    public readonly dependencyGroup: HealthCheckDependencyGroupTreeItem;
    public readonly fixableIssues: FixableHealthCheckIssue[];

    constructor(
        public readonly target: string,
        public readonly selected: boolean,
        public readonly status: TargetStatus,
        visibleDependencies: HealthCheckDependency[] = [],
        private readonly remoteProcessorNames: string[] = [],
        connectivityCheck?: HealthCheckDependency,
    ) {
        super(target, vscode.TreeItemCollapsibleState.Expanded);
        const diagnosticsMessage = getConnectivityDiagnosticsMessage(
            selected,
            connectivityCheck,
        );
        this.id = target;
        this.description = diagnosticsMessage;
        this.tooltip = diagnosticsMessage
            ? `${target}: ${diagnosticsMessage}`
            : undefined;
        this.iconPath = getTargetTreeItemIcon(selected, status);
        const contextValues = ['Target'];
        if (selected) {
            contextValues.push('Selected');
        }
        if (status === 'connected') {
            contextValues.push('Connected');
        }
        const issues = [...visibleDependencies];
        if (connectivityCheck) {
            issues.unshift(connectivityCheck);
        }
        this.fixableIssues = issues.filter(hasFixableIssueFix);
        this.dependencyGroup = new HealthCheckDependencyGroupTreeItem(
            visibleDependencies,
        );
        if (this.fixableIssues.length > 0) {
            contextValues.push('HasFixableDependencies');
        }
        this.contextValue = contextValues.join(' ');
        this.collapsibleState = getTargetTreeItemState(selected, status);
    }

    public get displayName(): string {
        return this.label?.toString() ?? '';
    }

    public createSubsystemGroup(
        containers: ContainerItem[] = [],
    ): TargetSubsystemGroupTreeItem {
        return new TargetSubsystemGroupTreeItem(
            this.target,
            this.remoteProcessorNames,
            containers,
        );
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
