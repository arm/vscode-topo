import * as vscode from 'vscode';
import { TargetTreeContainerItem } from './targetTreeContainerItem';
import { ContainersManager } from '../target/containersManager';
import * as manifest from '../manifest';
import { TargetStore } from '../target/targetStore';
import { TargetTreeTargetItem } from './targetTreeTargetItem';
import { TargetTreeSubsystemItem } from './targetTreeSubsystemItem';
import { logger } from '../util/logger';
import { HealthCheckDependencyGroupTreeItem } from '../treeItems/healthCheckDependencyGroupTreeItem';
import { TargetTreeSubsystemGroupItem } from './targetTreeSubsystemGroupItem';
import { HealthCheckDependencyTreeItem } from '../treeItems/healthCheckDependencyTreeItem';
import { HealthCheckDependency } from '../topoCliSchema';
import { TargetDescriptionStore } from '../target/targetDescriptionStore';

function sortDependenciesByName(
    deps: HealthCheckDependency[],
): HealthCheckDependency[] {
    return deps.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
}

export class TargetTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    public static readonly selectTargetCommand = `${manifest.PACKAGE_NAME}.selectTarget`;
    public static readonly removeTargetCommand = `${manifest.PACKAGE_NAME}.removeTarget`;
    public static readonly inspectTargetHealthCommand = `${manifest.PACKAGE_NAME}.inspectTargetHealth`;
    public static readonly inspectTargetHealthScheme = `${manifest.PACKAGE_NAME}-inspect-target-health`;

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
        private readonly targetDescriptionStore: TargetDescriptionStore,
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
                TargetTreeDataProvider.inspectTargetHealthCommand,
                (node: unknown) => this.inspectHealth(node),
            ),
            vscode.workspace.registerTextDocumentContentProvider(
                TargetTreeDataProvider.inspectTargetHealthScheme,
                this.inspectHealthContentProvider,
            ),
            onTargetStoreChanged,
            onContainersManagerDataUpdate,
            this._onDidChangeTreeData,
        );
    }

    private async selectTarget(treeNode: unknown): Promise<void> {
        if (!(treeNode instanceof TargetTreeTargetItem)) {
            const errMsg = `Invalid target type for select: expected TargetTreeTargetItem but received:`;
            logger.error(errMsg, treeNode);
            return;
        }
        await this.targetStore.setSelected(treeNode.target);
    }

    private async removeTarget(treeNode: unknown): Promise<void> {
        if (!(treeNode instanceof TargetTreeTargetItem)) {
            const errMsg = `Invalid target type for remove: expected TargetTreeTargetItem but received:`;
            logger.error(errMsg, treeNode);
            return;
        }
        try {
            await this.targetStore.deleteTarget(treeNode.target);
        } catch (err) {
            const errorMessage = `Failed to remove target`;
            vscode.window.showErrorMessage(errorMessage);
            logger.error(errorMessage, err);
        } finally {
            this._onDidChangeTreeData.fire(undefined);
        }
    }

    private async inspectHealth(treeNode: unknown): Promise<void> {
        if (!(treeNode instanceof TargetTreeTargetItem)) {
            const errMsg = `Invalid target type for inspect health: expected TargetTreeTargetItem but received:`;
            logger.error(errMsg, treeNode);
            return;
        }

        if (!treeNode.selected) {
            const errMsg = `Invalid target for inspect health: expected selected TargetTreeTargetItem but received:`;
            logger.error(errMsg, treeNode);
            return;
        }

        const targetState = await this.containersManager.getTargetState(
            treeNode.target,
        );
        const content = JSON.stringify(targetState.health ?? null, null, 4);
        const safeTargetSsh = treeNode.target.replace(/[^a-zA-Z0-9._-]/g, '_');
        const documentUri = vscode.Uri.from({
            scheme: TargetTreeDataProvider.inspectTargetHealthScheme,
            path: `/${safeTargetSsh}-health-${Date.now()}.json`,
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
            const selectedTarget = await this.targetStore.getSelectedTarget();
            const targetTreeItems = this.targetStore
                .getTargets()
                .map((target) => {
                    const selected = target === selectedTarget;
                    const { status } =
                        this.containersManager.getTargetStateSnapshot(target);
                    return new TargetTreeTargetItem(target, selected, status);
                });
            const sortedTargetTreeItems = targetTreeItems.sort((a, b) =>
                a.displayName.localeCompare(b.displayName),
            );
            return sortedTargetTreeItems;
        }

        if (element instanceof TargetTreeTargetItem) {
            if (!element.selected) {
                return [];
            }
            const [targetState, selectedTargetDescription] = await Promise.all([
                this.containersManager.getTargetState(element.target),
                this.targetDescriptionStore.getDescription(element.target),
            ]);
            if (targetState.health === undefined) {
                return [];
            }

            const dependencies = [...targetState.health.dependencies];
            if (selectedTargetDescription?.remoteProcessors.length) {
                dependencies.push(targetState.health.subsystemDriver);
            }

            const dependenciesGroup = new HealthCheckDependencyGroupTreeItem(
                dependencies,
            );
            const subsystemsGroup = new TargetTreeSubsystemGroupItem(
                element.target,
            );
            return [dependenciesGroup, subsystemsGroup];
        }

        if (element instanceof HealthCheckDependencyGroupTreeItem) {
            return sortDependenciesByName(element.dependencies).map(
                (d) => new HealthCheckDependencyTreeItem(d),
            );
        }

        if (element instanceof TargetTreeSubsystemGroupItem) {
            const targetDescription =
                await this.targetDescriptionStore.getDescription(
                    element.target,
                );
            const remoteProcessors =
                targetDescription?.remoteProcessors.map((rp) => rp.name) || [];
            const subsystemNames = ['Host', ...remoteProcessors];
            return subsystemNames.map(
                (name) => new TargetTreeSubsystemItem(name, element.target),
            );
        }

        if (element instanceof TargetTreeSubsystemItem) {
            const containers = await this.containersManager.getContainersData(
                element.target,
            );
            const subsystemContainers = containers.filter((item) =>
                element.group === 'Host'
                    ? item.runtime === manifest.TARGET_HOST_RUNTIME
                    : item.runtime === manifest.TARGET_REMOTEPROC_RUNTIME &&
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

        return [];
    }

    public getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    public refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }
}
