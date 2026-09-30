import * as vscode from 'vscode';
import { refreshProjectContainers } from '../commandIds';
import { ContainerCommands } from '../services/containerCommands';
import { showAndLogError } from '../util/showAndLog';
import { assertContainerTreeItem } from '../views/treeItems/assertContainerTreeItem';

const containerOperationMethods = {
    start: 'startContainer',
    stop: 'stopContainer',
    delete: 'deleteContainer',
} as const;

type ContainerOperation = keyof typeof containerOperationMethods;

export class ContainerLifecycle {
    constructor(private readonly containerCommands: ContainerCommands) {}

    public async startContainerCommandHandler(
        treeNode: unknown,
    ): Promise<void> {
        await this.runContainerCommand('start', treeNode);
    }

    public async stopContainerCommandHandler(treeNode: unknown): Promise<void> {
        await this.runContainerCommand('stop', treeNode);
    }

    public async deleteContainerCommandHandler(
        treeNode: unknown,
    ): Promise<void> {
        await this.runContainerCommand('delete', treeNode);
    }

    private async runContainerCommand(
        operation: ContainerOperation,
        treeNode: unknown,
    ): Promise<void> {
        assertContainerTreeItem(treeNode);
        const containerId = treeNode.containerItem.id;
        const commandMethod = containerOperationMethods[operation];

        const result = await this.containerCommands[commandMethod](
            containerId,
            treeNode.containerItem.target,
        );
        if (result.kind === 'error') {
            if (result.code !== 'DOCKER') {
                throw result;
            }
            showAndLogError(
                `Failed to ${operation} the container ${containerId}`,
                result,
            );
            return;
        }

        await vscode.commands.executeCommand(refreshProjectContainers);
    }
}
