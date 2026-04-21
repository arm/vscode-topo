import * as vscode from 'vscode';
import { ContainersManager } from '../workloadPlacement/containersManager';
import * as manifest from '../manifest';
import { assertTargetTreeContainerItem } from './util/assertTargetTreeContainerItem';
import { showAndLogError } from '../util/showAndLogError';
import { isWrappedError } from '../errors/wrappedError';

export class ContainerStop {
    public static readonly stopContainerCommand = `${manifest.PACKAGE_NAME}.stopContainer`;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly containersManager: ContainersManager,
    ) {}

    public async activate() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                ContainerStop.stopContainerCommand,
                this.stopContainerCommandHandler.bind(this),
            ),
        );
    }

    private async stopContainerCommandHandler(
        treeNode: unknown,
    ): Promise<void> {
        assertTargetTreeContainerItem(treeNode);
        try {
            await this.containersManager.stopContainer(
                treeNode.containerItem.id,
            );
        } catch (err: unknown) {
            if (isWrappedError(err, ['DOCKER'])) {
                const userError = `Failed to stop the container ${treeNode.containerItem.id}`;
                showAndLogError(userError, err);
                return;
            }
            throw err;
        }
    }
}
