import * as vscode from 'vscode';
import { BOARD_HOST_RUNTIME } from '../manifest';
import { ContainerItem } from './containersManager';

/** Represents an individual container in the target tree view. */
export class TargetTreeContainerItem extends vscode.TreeItem {

    public readonly subsystem: string;
    public readonly contextValue: string;
    public readonly state: string;
    public readonly name: string;

    constructor(
        public readonly containerItem: ContainerItem,
    ) {
        super(containerItem.image, vscode.TreeItemCollapsibleState.None);
        this.description = `${containerItem.name} - ${containerItem.runningFor}`;
        this.tooltip = `ID: ${containerItem.id}\nImage: ${containerItem.image}\nName: ${containerItem.name}\nStatus: ${containerItem.status}\nLabels: ${containerItem.labels}\nUptime: ${containerItem.runningFor}\n`;
        this.subsystem = containerItem.runtime === BOARD_HOST_RUNTIME ? 'Host' : 'Ambient';
        this.contextValue = `service ${containerItem.state} ${this.subsystem}`;
        this.iconPath = TargetTreeContainerItem.getIconForState(containerItem.state);
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
            return new vscode.ThemeIcon('debug-breakpoint-log', new vscode.ThemeColor('terminal.ansiWhite'));
        case 'running':
        default:
            return new vscode.ThemeIcon('debug-breakpoint-log', new vscode.ThemeColor('terminal.ansiGreen'));
        }
    }
}
