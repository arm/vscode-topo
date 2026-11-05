import { logger } from '../../util/logger';
import { ServiceTreeItem } from './serviceTreeItem';

export function assertServiceTreeItem(
    treeNode: unknown,
): asserts treeNode is ServiceTreeItem {
    if (!(treeNode instanceof ServiceTreeItem)) {
        const errMsg = `This operation cannot be performed on this item`;
        logger.error(errMsg, `Expected ServiceTreeItem but received`, treeNode);
        throw new Error(errMsg);
    }
}
