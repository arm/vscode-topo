import { logger } from '../../util/logger';
import { ContainerTreeItem } from './containerTreeItem';

/**
 * Asserts that the provided treeNode is an instance of ContainerTreeItem.
 * @param treeNode The tree node to check.
 * @throws Will throw an error if the treeNode is not a ContainerTreeItem.
 */
export function assertContainerTreeItem(
    treeNode: unknown,
): asserts treeNode is ContainerTreeItem {
    if (!(treeNode instanceof ContainerTreeItem)) {
        const errMsg = `This operation cannot be performed on this item`;
        logger.error(
            errMsg,
            `Expected ContainerTreeItem but received`,
            treeNode,
        );
        throw new Error(errMsg);
    }
}
