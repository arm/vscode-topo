import type { TaskFactory } from '../tasks/taskFactory';
import { assertServiceTreeItem } from '../views/treeItems/assertServiceTreeItem';
import { openLogs } from './openLogs';

export class OpenServiceLogs {
    constructor(private readonly taskFactory: TaskFactory) {}

    public async openServiceLogsCommandHandler(
        treeNode: unknown,
    ): Promise<void> {
        assertServiceTreeItem(treeNode);
        const item = treeNode.serviceItem.containers[0];
        await openLogs(
            this.taskFactory,
            `Logs: ${item.service} (${item.target})`,
            item.composeFileUri.fsPath,
            item.target,
            [item.service],
        );
    }
}
