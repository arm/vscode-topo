import type { TaskFactory } from '../tasks/taskFactory';
import { assertContainerTreeItem } from '../views/treeItems/assertContainerTreeItem';
import { openLogs } from './openLogs';

export class OpenContainerLogs {
    constructor(private readonly taskFactory: TaskFactory) {}

    public async openContainerLogsCommandHandler(
        treeNode: unknown,
    ): Promise<void> {
        assertContainerTreeItem(treeNode);
        const item = treeNode.containerItem;
        if (!item.service) {
            throw new Error(`Container ${item.id} has no Compose service name`);
        }

        await openLogs(
            this.taskFactory,
            `Logs: ${item.names || item.id} (${item.target})`,
            item.composeFileUri.fsPath,
            item.target,
            [item.service],
        );
    }
}
