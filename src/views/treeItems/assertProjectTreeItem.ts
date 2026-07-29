import { logger } from '../../util/logger';
import { ProjectTreeItem } from './projectTreeItem';

/**
 * Asserts that the provided treeNode is an instance of ProjectTreeItem.
 * @param treeNode The tree node to check.
 * @throws Will throw an error if the treeNode is not a ProjectTreeItem.
 */
export function assertProjectTreeItem(
    treeNode: unknown,
): asserts treeNode is ProjectTreeItem {
    if (!(treeNode instanceof ProjectTreeItem)) {
        const errMsg = `This operation cannot be performed on this item`;
        logger.error(errMsg, `Expected ProjectTreeItem but received`, treeNode);
        throw new Error(errMsg);
    }
}
