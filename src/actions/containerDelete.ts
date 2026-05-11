import * as vscode from 'vscode';
import * as manifest from '../manifest';
import { assertTargetContainerTreeItem } from '../targetTreeView/assertTargetContainerTreeItem';
import { showAndLogError } from '../util/showAndLogError';
import { isWrappedError } from '../errors/wrappedError';
import { ContainerCommands } from '../target/containerCommands';

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
                this.handleDeleteContainerCommand.bind(this),
            ),
        );
    }

    private async handleDeleteContainerCommand(
        treeNode: unknown,
    ): Promise<void> {
        assertTargetContainerTreeItem(treeNode);
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
