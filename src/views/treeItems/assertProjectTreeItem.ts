import { logger } from '../../util/logger';
import { ProjectTreeItem } from './projectTreeItem';

export function assertProjectTreeItem(
    treeNode: unknown,
): asserts treeNode is ProjectTreeItem {
    if (!(treeNode instanceof ProjectTreeItem)) {
        const errMsg = `This operation cannot be performed on this item`;
        logger.error(errMsg, `Expected ProjectTreeItem but received`, treeNode);
        throw new Error(errMsg);
    }
}
