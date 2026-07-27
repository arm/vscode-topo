import { ProjectController } from '../controllers/projectController';
import { isWrappedError } from '../errors/wrappedError';
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
    constructor(
        private readonly containerCommands: ContainerCommands,
        private readonly projectController: ProjectController,
    ) {}

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

        try {
            await this.containerCommands[commandMethod](
                containerId,
                treeNode.containerItem.target,
            );
        } catch (error: unknown) {
            if (isWrappedError(error, ['DOCKER'])) {
                showAndLogError(
                    `Failed to ${operation} the container ${containerId}`,
                    error,
                );
                return;
            }
            throw error;
        }

        await this.projectController.refreshProjectContainersCommandHandler();
    }
}
