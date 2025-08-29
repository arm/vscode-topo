import * as vscode from 'vscode';
import { BOARD_HOST_RUNTIME } from '../manifest';
import { ContainerItem } from './containersManager';

// Represents a group of containers (Host or Ambient)
export class ContainerGroupItem extends vscode.TreeItem {
    constructor(
    public readonly group: 'Host' | 'Ambient'
    ) {
        super(group, vscode.TreeItemCollapsibleState.Collapsed);
        this.contextValue = 'containerGroup';
    }
}

// Represents an individual container
export class ContainerTreeItem extends vscode.TreeItem implements ContainerItem {

    public readonly subsystem: string;

    constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly state: string,
    public readonly status: string,
    public readonly labels: string,
    public readonly runningFor: string,
    public readonly image: string,
    public readonly createdAt: string,
    public readonly runtime: string,
    public readonly ports: string[],
    public readonly cpuUsage: string,
    public readonly memUsage: string,
    ) {
        super(image, vscode.TreeItemCollapsibleState.None);
        this.description = `${name} - ${runningFor}`;
        this.tooltip = `ID: ${id}\nImage: ${image}\nName: ${name}\nStatus: ${status}\nLabels: ${labels}\nUptime: ${runningFor}\n`;
        this.subsystem = runtime === BOARD_HOST_RUNTIME ? 'Host' : 'Ambient';
        this.contextValue = `${state} ${this.subsystem}`;
        this.iconPath = ContainerTreeItem.getIconForState(state);
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
