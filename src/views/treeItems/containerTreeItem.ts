import * as vscode from 'vscode';
import { ContainerItem } from '../../util/types';
import { getContainerWebEndpoints } from '../../util/getContainerWebEndpoints';

function getContainerItemTooltip(containerItem: ContainerItem): string {
    return `ID: ${containerItem.id}
Image: ${containerItem.image}
Names: ${containerItem.names}
Status: ${containerItem.status}
State: ${containerItem.state}
Processing Domain: ${containerItem.processingDomain}
Address: ${containerItem.address}`;
}

export class ContainerTreeItem extends vscode.TreeItem {
    constructor(public readonly containerItem: ContainerItem) {
        super(containerItem.image, vscode.TreeItemCollapsibleState.None);
        this.description = `${containerItem.names} - ${containerItem.status}`;
        this.tooltip = getContainerItemTooltip(containerItem);
        const contextValues = [
            'service',
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
        this.iconPath = ContainerTreeItem.getIconForState(containerItem.state);
    }

    private static getIconForState(state: string): vscode.ThemeIcon {
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
                return new vscode.ThemeIcon(
                    'debug-breakpoint-log-unverified',
                    new vscode.ThemeColor('terminal.ansiWhite'),
                );
            case 'running':
            default:
                return new vscode.ThemeIcon(
                    'debug-breakpoint-log',
                    new vscode.ThemeColor('terminal.ansiGreen'),
                );
        }
    }
}
