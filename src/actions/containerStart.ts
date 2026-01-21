import * as vscode from 'vscode';
import { ContainersManager } from '../workloadPlacement/containersManager';
import * as manifest from '../manifest';
import { ensureTargetTreeContainerItem } from './util/ensureTargetTreeContainerItem';
import { logger } from '../util/logger';

export class ContainerStart {
    public static readonly startContainerCommand = `${manifest.PACKAGE_NAME}.startContainer`;

    constructor(
        private readonly context: Pick<
            vscode.ExtensionContext,
            'subscriptions'
        >,
        private readonly containersManager: Pick<
            ContainersManager,
            'startContainer'
        >,
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
        ensureTargetTreeContainerItem(treeNode);
        try {
            await this.containersManager.startContainer(
                treeNode.containerItem.id,
            );
        } catch (err: unknown) {
            const errorMsg = `Failed to start the container ${treeNode.containerItem.id}`;
            vscode.window.showErrorMessage(errorMsg);
            logger.error(errorMsg, err);
        }
    }
}
