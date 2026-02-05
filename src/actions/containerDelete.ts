import * as vscode from 'vscode';
import { ContainersManager } from '../workloadPlacement/containersManager';
import * as manifest from '../manifest';
import { assertTargetTreeContainerItem } from './util/assertTargetTreeContainerItem';
import { showAndLogError } from '../util/showAndLogError';
import { isTopoError } from '../errors/topoError';

export class ContainerDelete {
    public static readonly deleteContainerCommand = `${manifest.PACKAGE_NAME}.deleteContainer`;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly containersManager: ContainersManager,
    ) {}

    public activate() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                ContainerDelete.deleteContainerCommand,
                this.deleteContainerCommandHandler.bind(this),
            ),
        );
    }

    private async deleteContainerCommandHandler(
        treeNode: unknown,
    ): Promise<void> {
        assertTargetTreeContainerItem(treeNode);
        try {
            await this.containersManager.deleteContainer(
                treeNode.containerItem.id,
            );
        } catch (err: unknown) {
            if (isTopoError(err) && err.code === 'DOCKER') {
                const userError = `Failed to delete the container ${treeNode.containerItem.id}`;
                showAndLogError(userError, err);
                return;
            }
            throw err;
        }
    }
}
