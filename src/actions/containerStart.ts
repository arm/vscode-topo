import { assertContainerTreeItem } from '../views/treeItems/assertContainerTreeItem';
import { showAndLogError } from '../util/showAndLogError';
import { isWrappedError } from '../errors/wrappedError';
import { ContainerCommands } from '../services/containerCommands';
import { ProjectController } from '../controllers/projectController';

export class ContainerStart {
    constructor(
        private readonly containerCommands: ContainerCommands,
        private readonly projectController: ProjectController,
    ) {}

    public async startContainerCommandHandler(
        treeNode: unknown,
    ): Promise<void> {
        assertContainerTreeItem(treeNode);
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
        }
        await this.projectController.refreshProjectContainersCommandHandler();
    }
}
