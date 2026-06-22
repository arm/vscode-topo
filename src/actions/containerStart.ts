import { assertContainerTreeItem } from '../treeItems/assertContainerTreeItem';
import { showAndLogError } from '../util/showAndLogError';
import { isWrappedError } from '../errors/wrappedError';
import { ContainerCommands } from '../target/containerCommands';
import { TargetController } from '../controllers/targetController';

export class ContainerStart {
    constructor(
        private readonly containerCommands: ContainerCommands,
        private readonly targetController: TargetController,
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
        await this.targetController.refreshSelectedTargetDataCommandHandler();
    }
}
