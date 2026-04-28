import * as vscode from 'vscode';
import * as manifest from '../manifest';
import { assertTargetTreeContainerItem } from './util/assertTargetTreeContainerItem';
import { showAndLogError } from '../util/showAndLogError';
import { isWrappedError } from '../errors/wrappedError';
import { ContainerCommands } from '../workloadPlacement/containerCommands';

export class ContainerDelete {
    public static readonly deleteContainerCommand = `${manifest.PACKAGE_NAME}.deleteContainer`;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly containerCommands: ContainerCommands,
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
            await this.containerCommands.deleteContainer(
                treeNode.containerItem.id,
                treeNode.containerItem.target,
            );
        } catch (err: unknown) {
            if (isWrappedError(err, ['DOCKER'])) {
                const userError = `Failed to delete the container ${treeNode.containerItem.id}`;
                showAndLogError(userError, err);
                return;
            }
            throw err;
        }
    }
}
