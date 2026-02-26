import * as vscode from 'vscode';
import { TargetTreeContainerItem } from './targetTreeContainerItem';
import { ContainersManager } from './containersManager';
import * as manifest from '../manifest';
import { TargetStore } from './targetStore';
import { TargetTreeBoardItem } from './targetTreeBoardItem';
import { TargetTreeSubsystemItem } from './targetTreeSubsystemItem';
import { logger } from '../util/logger';
import { isTargetReady } from '../util/boardState';

export class TargetTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    public static readonly selectTargetCommand = `${manifest.PACKAGE_NAME}.selectTarget`;
    public static readonly removeTargetCommand = `${manifest.PACKAGE_NAME}.removeTarget`;
    public static readonly inspectBoardHealthCommand = `${manifest.PACKAGE_NAME}.inspectBoardHealth`;
    public static readonly inspectBoardHealthScheme = `${manifest.PACKAGE_NAME}-inspect-board-health`;

    private _onDidChangeTreeData = new vscode.EventEmitter<
        vscode.TreeItem | undefined
    >();
    public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private readonly inspectHealthDocuments = new Map<string, string>();
    private readonly inspectHealthContentProvider: vscode.TextDocumentContentProvider =
        {
            provideTextDocumentContent: (uri: vscode.Uri): string => {
                return (
                    this.inspectHealthDocuments.get(uri.toString()) ?? 'null'
                );
            },
        };

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly containersManager: ContainersManager,
        private readonly targetStore: TargetStore,
    ) {}

    public async activate(): Promise<void> {
        const onTargetStoreChanged = this.targetStore.onChanged(() => {
            this._onDidChangeTreeData.fire(undefined);
        });
        const onContainersManagerDataUpdate =
            this.containersManager.onDataUpdate(() => {
                this._onDidChangeTreeData.fire(undefined);
            });
        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                TargetTreeDataProvider.selectTargetCommand,
                (node: unknown) => this.selectTarget(node),
            ),
            vscode.commands.registerCommand(
                TargetTreeDataProvider.removeTargetCommand,
                (node: unknown) => this.removeTarget(node),
            ),
            vscode.commands.registerCommand(
                TargetTreeDataProvider.inspectBoardHealthCommand,
                (node: unknown) => this.inspectHealth(node),
            ),
            vscode.workspace.registerTextDocumentContentProvider(
                TargetTreeDataProvider.inspectBoardHealthScheme,
                this.inspectHealthContentProvider,
            ),
            onTargetStoreChanged,
            onContainersManagerDataUpdate,
            this._onDidChangeTreeData,
        );
    }

    private async selectTarget(treeNode: unknown): Promise<void> {
        if (!(treeNode instanceof TargetTreeBoardItem)) {
            const errMsg = `Invalid target type for select: expected TargetTreeBoardItem but received:`;
            logger.error(errMsg, treeNode);
            return;
        }
        await this.targetStore.setSelected(treeNode.targetId);
    }

    private async removeTarget(treeNode: unknown): Promise<void> {
        if (!(treeNode instanceof TargetTreeBoardItem)) {
            const errMsg = `Invalid target type for remove: expected TargetTreeBoardItem but received:`;
            logger.error(errMsg, treeNode);
            return;
        }
        try {
            await this.targetStore.deleteTarget(treeNode.targetId);
        } catch (err) {
            const errorMessage = `Failed to remove target`;
            vscode.window.showErrorMessage(errorMessage);
            logger.error(errorMessage, err);
        } finally {
            this._onDidChangeTreeData.fire(undefined);
        }
    }

    private async inspectHealth(treeNode: unknown): Promise<void> {
        if (!(treeNode instanceof TargetTreeBoardItem)) {
            const errMsg = `Invalid target type for inspect health: expected TargetTreeBoardItem but received:`;
            logger.error(errMsg, treeNode);
            return;
        }

        if (!treeNode.contextValue?.includes('Selected')) {
            const errMsg = `Invalid target for inspect health: expected selected TargetTreeBoardItem but received:`;
            logger.error(errMsg, treeNode);
            return;
        }

        const boardState = await this.containersManager.getBoardState();
        const content = JSON.stringify(boardState.health ?? null, null, 4);
        const safeTargetId = treeNode.targetId.replace(/[^a-zA-Z0-9._-]/g, '_');
        const documentUri = vscode.Uri.from({
            scheme: TargetTreeDataProvider.inspectBoardHealthScheme,
            path: `/${safeTargetId}-health-${Date.now()}.json`,
        });

        this.inspectHealthDocuments.clear();
        this.inspectHealthDocuments.set(documentUri.toString(), content);

        const document = await vscode.workspace.openTextDocument(documentUri);
        await vscode.window.showTextDocument(document, { preview: true });
    }

    public async getChildren(
        element?: vscode.TreeItem,
    ): Promise<vscode.TreeItem[]> {
        if (!element) {
            const boardState = await this.containersManager.getBoardState();
            const selectedTarget = await this.targetStore.getSelectedTarget();
            const boardTreeItems = this.targetStore
                .getTargets()
                .map((target) => {
                    const selected = target.id === selectedTarget?.id;
                    const connectionReady =
                        selected && target.id === boardState.targetId;
                    return new TargetTreeBoardItem(
                        target,
                        selected,
                        connectionReady,
                        isTargetReady(boardState),
                    );
                });
            const sortedBoardTreeItems = boardTreeItems.sort((a, b) =>
                a.displayName.localeCompare(b.displayName),
            );
            return sortedBoardTreeItems;
        }

        if (element instanceof TargetTreeBoardItem) {
            const remoteprocCpus =
                element.target.targetDescription?.remoteprocCPU.map(
                    (rp) => rp.name,
                ) || [];
            const subsystemNames = ['Host', ...remoteprocCpus];
            return subsystemNames.map(
                (name) => new TargetTreeSubsystemItem(name),
            );
        }

        if (!(element instanceof TargetTreeSubsystemItem)) {
            return [];
        }

        const containers = await this.containersManager.getContainersData();
        const subsystemContainers = containers.filter((item) =>
            element.group === 'Host'
                ? item.runtime === manifest.BOARD_HOST_RUNTIME
                : item.runtime === manifest.BOARD_REMOTEPROC_RUNTIME &&
                  item.annotations?.['remoteproc.name'] === element.group,
        );
        const subsystemTreeItems = subsystemContainers.map(
            (info) => new TargetTreeContainerItem(info),
        );
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
