import { assertContainerTreeItem } from '../views/treeItems/assertContainerTreeItem';
import { showAndLogError } from '../util/showAndLog';
import { isWrappedError } from '../errors/wrappedError';
import { ContainerCommands } from '../services/containerCommands';
import { ProjectController } from '../controllers/projectController';

export class ContainerDelete {
    constructor(
        private readonly containerCommands: ContainerCommands,
        private readonly projectController: ProjectController,
    ) {}

    public async deleteContainerCommandHandler(
        treeNode: unknown,
    ): Promise<void> {
        assertContainerTreeItem(treeNode);
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
        await this.projectController.refreshProjectContainersCommandHandler();
    }
}
