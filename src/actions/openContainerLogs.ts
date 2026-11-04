import path from 'node:path';
import * as vscode from 'vscode';
import { TOPO_TASK_TYPE } from '../manifest';
import { TaskCommand, type TaskFactory } from '../tasks/taskFactory';
import { assertContainerTreeItem } from '../views/treeItems/assertContainerTreeItem';

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

        const task = this.taskFactory.createTask(
            `Logs: ${item.names || item.id} (${item.target})`,
            {
                type: TOPO_TASK_TYPE,
                command: TaskCommand.Logs,
                args: [
                    '--file',
                    path.basename(item.composeFileUri.fsPath),
                    '--target',
                    item.target,
                    '--follow',
                    '--',
                    item.service,
                ],
                options: { cwd: path.dirname(item.composeFileUri.fsPath) },
            },
        );
        // Keep completed logs visible, including those from stopped containers.
        task.presentationOptions = {
            ...task.presentationOptions,
            panel: vscode.TaskPanelKind.Dedicated,
            close: false,
        };
        await vscode.tasks.executeTask(task);
    }
}
