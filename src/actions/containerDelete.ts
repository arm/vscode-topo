import * as vscode from 'vscode';
import { ContainersManager } from '../workloadPlacement/containersManager';
import * as manifest from '../manifest';
import { ensureTargetTreeContainerItem } from './util/ensureTargetTreeContainerItem';
import { logger } from '../util/logger';

export class ContainerDelete {

    public static readonly deleteContainerCommand = `${manifest.PACKAGE_NAME}.deleteContainer`;

    constructor(
        private readonly context: Pick<vscode.ExtensionContext, 'subscriptions'>,
        private readonly containersManager: Pick<ContainersManager, 'deleteContainer'>,
    ) {}

    public activate() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(ContainerDelete.deleteContainerCommand, this.deleteContainerCommandHandler.bind(this))
        );
    }

    private async deleteContainerCommandHandler(treeNode: unknown): Promise<void> {
        ensureTargetTreeContainerItem(treeNode);
        try {
            await this.containersManager.deleteContainer(treeNode.containerItem.id);
        } catch (err: unknown) {
            const errorMsg = `Failed to delete the container ${treeNode.containerItem.id}`;
            vscode.window.showErrorMessage(errorMsg);
            logger.error(errorMsg, err);
        }
    }
}

