import { logger } from '../util/logger';
import { TargetContainerTreeItem } from './targetContainerTreeItem';

/**
 * Asserts that the provided treeNode is an instance of TargetContainerTreeItem.
 * @param treeNode The tree node to check.
 * @throws Will throw an error if the treeNode is not a TargetContainerTreeItem.
 */
export function assertTargetContainerTreeItem(
    treeNode: unknown,
): asserts treeNode is TargetContainerTreeItem {
    if (!(treeNode instanceof TargetContainerTreeItem)) {
        const errMsg = `This operation cannot be performed on this item`;
        logger.error(
            errMsg,
            `Expected TargetContainerTreeItem but received`,
            treeNode,
        );
        throw new Error(errMsg);
    }
}
