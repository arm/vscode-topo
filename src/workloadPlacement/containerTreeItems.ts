import * as vscode from 'vscode';
import { BOARD_HOST_RUNTIME } from '../manifest';
import { ContainerItem } from './containersManager';
import { Target } from './target';

/** Represents an individual container in the target tree view. */
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
        public readonly target: Target
    ) {
        super(image, vscode.TreeItemCollapsibleState.None);
        this.description = `${name} - ${runningFor}`;
        this.tooltip = `ID: ${id}\nImage: ${image}\nName: ${name}\nStatus: ${status}\nLabels: ${labels}\nUptime: ${runningFor}\n`;
        this.subsystem = runtime === BOARD_HOST_RUNTIME ? 'Host' : 'Ambient';
        this.contextValue = `service ${state} ${this.subsystem}`;
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
