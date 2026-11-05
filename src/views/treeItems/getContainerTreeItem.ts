import { assertContainerTreeItem } from './assertContainerTreeItem';
import { ContainerTreeItem } from './containerTreeItem';
import { ServiceTreeItem } from './serviceTreeItem';

export function getContainerTreeItem(treeNode: unknown): ContainerTreeItem {
    const item =
        treeNode instanceof ServiceTreeItem
            ? treeNode.containerTreeItem
            : treeNode;
    assertContainerTreeItem(item);
    return item;
}
