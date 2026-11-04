import type { TaskFactory } from '../tasks/taskFactory';
import { assertProjectTreeItem } from '../views/treeItems/assertProjectTreeItem';
import { openLogs } from './openLogs';

export class OpenProjectLogs {
    constructor(private readonly taskFactory: TaskFactory) {}

    public async openProjectLogsCommandHandler(
        treeNode: unknown,
    ): Promise<void> {
        assertProjectTreeItem(treeNode);
        const containers = treeNode.containers;
        if (containers.status !== 'loaded' || containers.data.length === 0) {
            return;
        }

        const target = containers.data[0].target;
        await openLogs(
            this.taskFactory,
            `Logs: ${treeNode.composeFileUri.fsPath} (${target})`,
            treeNode.composeFileUri.fsPath,
            target,
        );
    }
}
