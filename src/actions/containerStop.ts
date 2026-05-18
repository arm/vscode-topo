import * as vscode from 'vscode';
import * as manifest from '../manifest';
import { assertTargetContainerTreeItem } from '../targetTreeView/assertTargetContainerTreeItem';
import { showAndLogError } from '../util/showAndLogError';
import { isWrappedError } from '../errors/wrappedError';
import { ContainerCommands } from '../target/containerCommands';
import { refreshTargetContainersCommand } from '../refreshCommands';

export class ContainerStop {
    public static readonly stopContainerCommand = `${manifest.PACKAGE_NAME}.stopContainer`;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly containerCommands: ContainerCommands,
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
        assertTargetContainerTreeItem(treeNode);
        try {
            await this.containerCommands.stopContainer(
                treeNode.containerItem.id,
                treeNode.containerItem.target,
            );
        } catch (err: unknown) {
            if (isWrappedError(err, ['DOCKER'])) {
                const userError = `Failed to stop the container ${treeNode.containerItem.id}`;
                showAndLogError(userError, err);
                return;
            }
            throw err;
        } finally {
            vscode.commands.executeCommand(refreshTargetContainersCommand);
        }
    }
}
