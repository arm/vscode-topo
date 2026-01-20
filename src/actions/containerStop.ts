import * as vscode from 'vscode';
import { ContainersManager } from '../workloadPlacement/containersManager';
import * as manifest from '../manifest';
import { ensureTargetTreeContainerItem } from './util/ensureTargetTreeContainerItem';
import { logger } from '../util/logger';

export class ContainerStop {

    public static readonly stopContainerCommand = `${manifest.PACKAGE_NAME}.stopContainer`;

    constructor(
        private readonly context: Pick<vscode.ExtensionContext, 'subscriptions'>,
        private readonly containersManager: Pick<ContainersManager, 'stopContainer'>,
    ) {}

    public async activate() {

        this.context.subscriptions.push(
            vscode.commands.registerCommand(ContainerStop.stopContainerCommand, this.stopContainerCommandHandler.bind(this)),
        );
    }

    private async stopContainerCommandHandler(treeNode: unknown): Promise<void> {
        ensureTargetTreeContainerItem(treeNode);
        try {
            await this.containersManager.stopContainer(treeNode.containerItem.id);
        } catch (err: unknown) {
            const errorMsg = `Failed to stop the container ${treeNode.containerItem.id}`;
            vscode.window.showErrorMessage(errorMsg);
            logger.error(errorMsg, err);
        }
    }

}
