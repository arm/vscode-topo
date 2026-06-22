import { assertContainerTreeItem } from '../treeItems/assertContainerTreeItem';
import { showAndLogError } from '../util/showAndLogError';
import { isWrappedError } from '../errors/wrappedError';
import { ContainerCommands } from '../target/containerCommands';
import { TargetController } from '../controllers/targetController';

export class ContainerDelete {
    constructor(
        private readonly containerCommands: ContainerCommands,
        private readonly targetController: TargetController,
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
        await this.targetController.refreshSelectedTargetHealthCommandHandler();
    }
}
