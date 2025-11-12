import * as vscode from 'vscode';
import { ContainerTreeItem } from './containerTreeItems';
import { ContainersManager } from './containersManager';
import * as manifest from '../manifest';

/** Represents a board */
class BoardTreeItem extends vscode.TreeItem {
    constructor() {
        super('Board', vscode.TreeItemCollapsibleState.Expanded);
        this.description = manifest.BOARD_HOSTNAME;
        this.iconPath = new vscode.ThemeIcon('chip');
    }
}

/** Represents a subsystem of the target (Host or Ambient) */
export class SubsystemTreeItem extends vscode.TreeItem {
    constructor(
        public readonly group: 'Host' | 'Ambient'
    ) {
        super(group, vscode.TreeItemCollapsibleState.Collapsed);
        this.iconPath = new vscode.ThemeIcon('multiple-windows');
        this.contextValue = `Subsystem ${group}`;
    }
}

export class TargetTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private containersManager: ContainersManager;

    constructor(containersManager: ContainersManager) {
        this.containersManager = containersManager;
        this.containersManager.onDataUpdate(() => {
            this._onDidChangeTreeData.fire(undefined);
        });
    }

    async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        if (!element) {
            const boardState = await this.containersManager.getBoardState();
            if (!boardState.isReachable) {
                const noBoardItem = new vscode.TreeItem('No board found', vscode.TreeItemCollapsibleState.None);
                noBoardItem.iconPath = new vscode.ThemeIcon('error');
                noBoardItem.description = '';
                noBoardItem.contextValue = 'noBoard';
                return [noBoardItem];
            }
            if (!boardState.hasContainerRuntime) {
                const noBoardItem = new vscode.TreeItem('No container runtime found', vscode.TreeItemCollapsibleState.None);
                noBoardItem.iconPath = new vscode.ThemeIcon('error');
                noBoardItem.description = '';
                noBoardItem.contextValue = 'noContainerRuntime';
                return [noBoardItem];
            }
            return [
                new BoardTreeItem()
            ];
        }

        if (element instanceof BoardTreeItem) {
            const hostSubsystem = new SubsystemTreeItem('Host');
            const ambientSubsystem = new SubsystemTreeItem('Ambient');
            return [
                hostSubsystem,
                ambientSubsystem
            ];
        }

        if (!(element instanceof SubsystemTreeItem)) {
            return [];
        }

        const containers = await this.containersManager.getContainersData();
        const subsystemContainers = containers.filter(item =>
            element.group === 'Host'
                ? item.runtime === manifest.BOARD_HOST_RUNTIME
                : item.runtime === manifest.BOARD_AMBIENT_RUNTIME
        );
        const subsystemTreeItems = subsystemContainers.map(info => new ContainerTreeItem(
            info.id,
            info.name,
            info.state,
            info.status,
            info.labels,
            info.runningFor,
            info.image,
            info.createdAt,
            info.runtime,
            info.ports,
            info.cpuUsage,
            info.memUsage,
        ));
        const sortedSubsystemTreeItems = subsystemTreeItems.sort((a, b) => {
            if (a.state === 'running' && b.state !== 'running') {
                return -1;
            }
            if (a.state !== 'running' && b.state === 'running') {
                return 1;
            }
            return a.name.localeCompare(b.name);
        });
        return sortedSubsystemTreeItems;
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }
}
