import * as vscode from 'vscode';
import { ContainerItem, ServiceItem } from '../../util/types';
import { ServiceTreeItem } from './serviceTreeItem';

function groupContainersByService(
    containers: readonly ContainerItem[],
): ServiceItem[] {
    const containersByService = Map.groupBy(
        containers,
        (container) => container.service,
    );

    return [...containersByService.entries()].map(([name, containers]) => ({
        name,
        containers,
    }));
}

function compareServices(a: ServiceItem, b: ServiceItem): number {
    const aRunning = a.containers.some(
        (container) => container.state === 'running',
    );
    const bRunning = b.containers.some(
        (container) => container.state === 'running',
    );
    if (aRunning && !bRunning) {
        return -1;
    }
    if (!aRunning && bRunning) {
        return 1;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

export class ProcessingDomainTreeItem extends vscode.TreeItem {
    private readonly services: readonly ServiceItem[];

    constructor(
        processingDomain: string,
        containers?: readonly ContainerItem[],
    ) {
        super(
            processingDomain,
            containers === undefined
                ? vscode.TreeItemCollapsibleState.None
                : vscode.TreeItemCollapsibleState.Expanded,
        );
        this.services = groupContainersByService(containers ?? []);
        if (containers !== undefined) {
            this.description = `${this.services.length} service${this.services.length === 1 ? '' : 's'}`;
        }
        this.iconPath = new vscode.ThemeIcon('multiple-windows');
        this.contextValue = `ProcessingDomain ${processingDomain}`;
    }

    public getChildren(): ServiceTreeItem[] {
        return this.services
            .toSorted(compareServices)
            .map((service) => new ServiceTreeItem(service));
    }
}
