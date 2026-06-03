import { assertTargetContainerTreeItem } from '../targetTreeView/assertTargetContainerTreeItem';
import { showAndLogError } from '../util/showAndLogError';
import { isWrappedError } from '../errors/wrappedError';
import { ContainerCommands } from '../target/containerCommands';

export class ContainerStop {
    constructor(private readonly containerCommands: ContainerCommands) {}

    public async stopContainerCommandHandler(treeNode: unknown): Promise<void> {
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
        }
    }
}
