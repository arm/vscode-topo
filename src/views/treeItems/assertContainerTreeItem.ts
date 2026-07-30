import { logger } from '../../util/logger';
import { ContainerTreeItem } from './containerTreeItem';

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
