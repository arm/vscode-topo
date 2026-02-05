import * as vscode from 'vscode';
import { ContainersManager } from '../workloadPlacement/containersManager';
import * as manifest from '../manifest';
import { assertTargetTreeContainerItem } from './util/assertTargetTreeContainerItem';
import { showAndLogError } from '../util/showAndLogError';
import { isTopoError } from '../errors/topoError';

export class ContainerStart {
    public static readonly startContainerCommand = `${manifest.PACKAGE_NAME}.startContainer`;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly containersManager: ContainersManager,
    ) {}

    public activate() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                ContainerStart.startContainerCommand,
                this.startContainerCommandHandler.bind(this),
            ),
        );
    }

    private async startContainerCommandHandler(
        treeNode: unknown,
    ): Promise<void> {
        assertTargetTreeContainerItem(treeNode);
        try {
            await this.containersManager.startContainer(
                treeNode.containerItem.id,
            );
        } catch (err: unknown) {
            if (isTopoError(err) && err.code === 'DOCKER') {
                const userError = `Failed to start the container ${treeNode.containerItem.id}`;
                showAndLogError(userError, err);
                return;
            }
            throw err;
        }
    }
}
