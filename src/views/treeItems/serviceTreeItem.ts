import * as vscode from 'vscode';
import { ContainerItem, ServiceItem } from '../../util/types';
import { runningIcon, warningIcon } from '../util/containerStateIcon';
import { ContainerTreeItem } from './containerTreeItem';

function compareContainers(a: ContainerItem, b: ContainerItem): number {
    if (a.state === 'running' && b.state !== 'running') {
        return -1;
    }
    if (a.state !== 'running' && b.state === 'running') {
        return 1;
    }
    return a.names.localeCompare(b.names, undefined, { sensitivity: 'base' });
}

function getServiceItemDescription(serviceItem: ServiceItem): string {
    const states = Map.groupBy(
        serviceItem.containers,
        (container) => container.state,
    );
    return [...states.entries()]
        .sort(([a], [b]) => {
            if (a === 'running') {
                return -1;
            }
            if (b === 'running') {
                return 1;
            }
            return a.localeCompare(b);
        })
        .map(([state, replicas]) => `${replicas.length} ${state}`)
        .join(', ');
}

function getServiceItemTooltip(
    serviceItem: ServiceItem,
    description: string,
): string {
    const { name, containers } = serviceItem;
    const container = containers[0];
    const images = [...new Set(containers.map((replica) => replica.image))];

    return [
        `Service: ${name}`,
        `Replicas: ${containers.length}`,
        `Status: ${description}`,
        `Images: ${images.join(', ')}`,
        `Processing Domain: ${container.processingDomain}`,
    ].join('\n');
}

function getServiceItemIcon(serviceItem: ServiceItem): vscode.ThemeIcon {
    const allRunning = serviceItem.containers.every(
        (container) => container.state === 'running',
    );
    return allRunning ? runningIcon : warningIcon;
}

export class ServiceTreeItem extends vscode.TreeItem {
    constructor(public readonly serviceItem: ServiceItem) {
        super(serviceItem.name, vscode.TreeItemCollapsibleState.Collapsed);
        this.iconPath = getServiceItemIcon(serviceItem);

        this.description = getServiceItemDescription(serviceItem);
        this.tooltip = getServiceItemTooltip(serviceItem, this.description);
        this.contextValue = 'service';
    }

    public getChildren(): ContainerTreeItem[] {
        return this.serviceItem.containers
            .toSorted(compareContainers)
            .map((container) => new ContainerTreeItem(container));
    }
}
