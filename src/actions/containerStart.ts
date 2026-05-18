import * as vscode from 'vscode';
import * as manifest from '../manifest';
import { assertTargetContainerTreeItem } from '../targetTreeView/assertTargetContainerTreeItem';
import { showAndLogError } from '../util/showAndLogError';
import { isWrappedError } from '../errors/wrappedError';
import { ContainerCommands } from '../target/containerCommands';
import { refreshTargetContainersCommand } from '../refreshCommands';

export class ContainerStart {
    public static readonly startContainerCommand = `${manifest.PACKAGE_NAME}.startContainer`;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly containerCommands: ContainerCommands,
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
        assertTargetContainerTreeItem(treeNode);
        try {
            await this.containerCommands.startContainer(
                treeNode.containerItem.id,
                treeNode.containerItem.target,
            );
        } catch (err: unknown) {
            if (isWrappedError(err, ['DOCKER'])) {
                const userError = `Failed to start the container ${treeNode.containerItem.id}`;
                showAndLogError(userError, err);
                return;
            }
            throw err;
        } finally {
            vscode.commands.executeCommand(refreshTargetContainersCommand);
        }
    }
}
