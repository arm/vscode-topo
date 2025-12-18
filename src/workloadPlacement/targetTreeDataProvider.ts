import * as vscode from 'vscode';
import { TargetTreeContainerItem } from './targetTreeContainerItem';
import { ContainersManager } from './containersManager';
import * as manifest from '../manifest';
import { TargetStore } from './targetStore';
import { TargetTreeBoardItem } from './targetTreeBoardItem';
import { TargetTreeSubsystemItem } from './targetTreeSubsystemItem';
import { logger } from '../util/logger';
import { getErrorMessage } from '../util/getErrorMessage';

export class TargetTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {

    public static readonly selectTargetCommand = `${manifest.PACKAGE_NAME}.selectTarget`;
    public static readonly removeTargetCommand = `${manifest.PACKAGE_NAME}.removeTarget`;

    private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined>();
    public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(
        private readonly context: Pick<vscode.ExtensionContext, 'subscriptions'>,
        private readonly containersManager: ContainersManager,
        private readonly targetStore: Pick<TargetStore, 'getSelectedTarget' | 'getTargets' | 'setSelected' | 'onChanged' | 'deleteTarget'>,
    ) {
    }

    public async activate(): Promise<void> {
        const onTargetStoreChanged = this.targetStore.onChanged(() => {
            this._onDidChangeTreeData.fire(undefined);
        });
        const onContainersManagerDataUpdate = this.containersManager.onDataUpdate(() => {
            this._onDidChangeTreeData.fire(undefined);
        });
        this.context.subscriptions.push(
            vscode.commands.registerCommand(TargetTreeDataProvider.selectTargetCommand, (node: unknown) => this.selectTarget(node)),
            vscode.commands.registerCommand(TargetTreeDataProvider.removeTargetCommand, (node: unknown) => this.removeTarget(node)),
            onTargetStoreChanged,
            onContainersManagerDataUpdate,
            this._onDidChangeTreeData,
        );
    }

    private async selectTarget(treeNode: unknown): Promise<void> {
        if (!(treeNode instanceof TargetTreeBoardItem)) {
            const errMsg = `Invalid target type for select: expected TargetTreeBoardItem but received\n${JSON.stringify(treeNode, null, 2)}`;
            logger.error(errMsg);
            return;
        }
        await this.targetStore.setSelected(treeNode.targetId);
    }

    private async removeTarget(treeNode: unknown): Promise<void> {
        if (!(treeNode instanceof TargetTreeBoardItem)) {
            const errMsg = `Invalid target type for remove: expected TargetTreeBoardItem but received\n${JSON.stringify(treeNode, null, 2)}`;
            logger.error(errMsg);
            return;
        }
        try {
            await this.targetStore.deleteTarget(treeNode.targetId);
        } catch (err) {
            const errorMessage = `Failed to remove target: ${getErrorMessage(err)}`;
            vscode.window.showErrorMessage(errorMessage);
            logger.error(errorMessage);
        } finally {
            this._onDidChangeTreeData.fire(undefined);
        }
    }

    public async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        if (!element) {
            const boardState = await this.containersManager.getBoardState();
            const selectedTarget = await this.targetStore.getSelectedTarget();
            const boardTreeItems = this.targetStore.getTargets().map(target => {
                const selected = target.id === selectedTarget?.id;
                const connectionReady = selected && target.id === boardState.targetId;
                const targetReady = boardState.isReachable && boardState.hasContainerRuntime;
                return new TargetTreeBoardItem(target, selected, connectionReady, targetReady);
            });
            const sortedBoardTreeItems = boardTreeItems.sort((a, b) => a.displayName.localeCompare(b.displayName));
            return sortedBoardTreeItems;
        }

        if (element instanceof TargetTreeBoardItem) {
            const hostSubsystem = new TargetTreeSubsystemItem('Host');
            const ambientSubsystem = new TargetTreeSubsystemItem('Ambient');
            return [
                hostSubsystem,
                ambientSubsystem
            ];
        }

        if (!(element instanceof TargetTreeSubsystemItem)) {
            return [];
        }

        const containers = await this.containersManager.getContainersData();
        const subsystemContainers = containers.filter(item =>
            element.group === 'Host'
                ? item.runtime === manifest.BOARD_HOST_RUNTIME
                : item.runtime === manifest.BOARD_AMBIENT_RUNTIME
        );
        const subsystemTreeItems = subsystemContainers.map(info => new TargetTreeContainerItem(
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
            info.target,
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

    public getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    public refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

}
