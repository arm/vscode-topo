import * as vscode from 'vscode';
import { ContainersManager } from '../workloadPlacement/containersManager';
import * as manifest from '../manifest';
import { assertTargetTreeContainerItem } from './util/assertTargetTreeContainerItem';
import { showAndLogError } from '../util/showAndLogError';
import { isTopoError } from '../errors/topoError';

export class ContainerStop {
    public static readonly stopContainerCommand = `${manifest.PACKAGE_NAME}.stopContainer`;

    constructor(
        private readonly context: Pick<
            vscode.ExtensionContext,
            'subscriptions'
        >,
        private readonly containersManager: Pick<
            ContainersManager,
            'stopContainer'
        >,
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
            if (isTopoError(err) && err.code === 'DOCKER') {
                const userError = `Failed to stop the container ${treeNode.containerItem.id}`;
                showAndLogError(userError, err);
                return;
            }
            throw err;
        }
    }
}
