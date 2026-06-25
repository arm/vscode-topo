import { assertContainerTreeItem } from '../treeItems/assertContainerTreeItem';
import { showAndLogError } from '../util/showAndLogError';
import { isWrappedError } from '../errors/wrappedError';
import { ContainerCommands } from '../target/containerCommands';
import { ProjectController } from '../controllers/projectController';

export class ContainerStop {
    constructor(
        private readonly containerCommands: ContainerCommands,
        private readonly projectController: ProjectController,
    ) {}

    public async stopContainerCommandHandler(treeNode: unknown): Promise<void> {
        assertContainerTreeItem(treeNode);
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
        }
        await this.projectController.refreshProjectContainersCommandHandler();
    }
}
