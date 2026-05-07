import { logger } from '../util/logger';
import { TargetTreeContainerItem } from './targetTreeContainerItem';

/**
 * Asserts that the provided treeNode is an instance of TargetTreeContainerItem.
 * @param treeNode The tree node to check.
 * @throws Will throw an error if the treeNode is not a TargetTreeContainerItem.
 */
export function assertTargetTreeContainerItem(
    treeNode: unknown,
): asserts treeNode is TargetTreeContainerItem {
    if (!(treeNode instanceof TargetTreeContainerItem)) {
        const errMsg = `This operation cannot be performed on this item`;
        logger.error(
            errMsg,
            `Expected TargetTreeContainerItem but received`,
            treeNode,
        );
        throw new Error(errMsg);
    }
}
