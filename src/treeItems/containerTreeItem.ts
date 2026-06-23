import * as vscode from 'vscode';
import { TARGET_HOST_RUNTIME, TARGET_REMOTEPROC_RUNTIME } from '../manifest';
import { ContainerItem } from '../util/types';

export class ContainerTreeItem extends vscode.TreeItem {
    public readonly contextValue: string;
    public readonly state: string;
    public readonly name: string;

    constructor(public readonly containerItem: ContainerItem) {
        super(containerItem.image, vscode.TreeItemCollapsibleState.None);
        this.description = `${containerItem.name} - ${containerItem.runningFor}`;
        this.tooltip = `ID: ${containerItem.id}\nImage: ${containerItem.image}\nName: ${containerItem.name}\nStatus: ${containerItem.status}\nLabels: ${containerItem.labels}\nUptime: ${containerItem.runningFor}\n`;
        let processingDomainCategory: string | undefined;
        if (containerItem.runtime === TARGET_HOST_RUNTIME) {
            processingDomainCategory = 'PrimaryOS';
        }
        if (containerItem.runtime === TARGET_REMOTEPROC_RUNTIME) {
            processingDomainCategory = 'Remoteproc';
        }
        const contextValues = ['service', containerItem.state];
        if (processingDomainCategory) {
            contextValues.push(processingDomainCategory);
        }
        this.contextValue = contextValues.join(' ');
        this.iconPath = ContainerTreeItem.getIconForState(containerItem.state);
        this.state = containerItem.state;
        this.name = containerItem.name;
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
                    'debug-breakpoint-log',
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
