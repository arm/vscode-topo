import * as vscode from 'vscode';
import { ContainerItem } from '../../util/types';
import { getContainerWebEndpoints } from '../../util/getContainerWebEndpoints';
import { notRunningIcon, runningIcon } from '../util/containerStateIcon';

function getContainerItemTooltip(containerItem: ContainerItem): string {
    return `ID: ${containerItem.id}
Service: ${containerItem.service}
Image: ${containerItem.image}
Names: ${containerItem.names}
Status: ${containerItem.status}
State: ${containerItem.state}
Processing Domain: ${containerItem.processingDomain}
Address: ${containerItem.address}`;
}

function getContainerStateIcon(state: string): vscode.ThemeIcon {
    switch (state.toLowerCase()) {
        case 'created':
        case 'dead':
        case 'exited':
        case 'removing':
        case 'terminated':
        case 'unknown':
        case 'waiting':
        case 'paused':
        case 'restarting':
            return notRunningIcon;
        case 'running':
        default:
            return runningIcon;
    }
}

export class ContainerTreeItem extends vscode.TreeItem {
    constructor(public readonly containerItem: ContainerItem) {
        super(
            containerItem.names || containerItem.id,
            vscode.TreeItemCollapsibleState.None,
        );
        this.description = containerItem.status || containerItem.state;
        this.tooltip = getContainerItemTooltip(containerItem);
        const contextValues = [
            'container',
            containerItem.state,
            containerItem.processingDomain,
        ];
        if (
            containerItem.state === 'running' &&
            getContainerWebEndpoints(containerItem.address).length > 0
        ) {
            contextValues.push('browser');
        }
        this.contextValue = contextValues.join(' ');
        this.iconPath = getContainerStateIcon(containerItem.state);
    }
}
