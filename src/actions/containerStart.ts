import { assertTargetContainerTreeItem } from '../targetTreeView/assertTargetContainerTreeItem';
import { showAndLogError } from '../util/showAndLogError';
import { isWrappedError } from '../errors/wrappedError';
import { ContainerCommands } from '../target/containerCommands';

export class ContainerStart {
    constructor(private readonly containerCommands: ContainerCommands) {}

    public async startContainerCommandHandler(
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
        }
    }
}
