import * as vscode from 'vscode';
import type { ContainerCommands } from '../services/containerCommands';
import type { TaskFactory } from '../tasks/taskFactory';
import { assertProjectTreeItem } from '../views/treeItems/assertProjectTreeItem';

export class OpenProjectLogs {
    constructor(
        private readonly containerCommands: ContainerCommands,
        private readonly taskFactory: TaskFactory,
    ) {}

    public async openProjectLogsCommandHandler(
        treeNode: unknown,
    ): Promise<void> {
        assertProjectTreeItem(treeNode);
        const containers = treeNode.containers;
        if (containers.status !== 'loaded' || containers.data.length === 0) {
            return;
        }

        const target = containers.data[0].target;
        const command = await this.containerCommands.getProjectLogsCommand(
            containers.data.map((container) => container.id),
            target,
        );
        const task = this.taskFactory.createShellTask(
            `Logs: ${treeNode.composeFileUri.fsPath} (${target})`,
            command,
        );
        task.presentationOptions = {
            ...task.presentationOptions,
            panel: vscode.TaskPanelKind.Dedicated,
            close: false,
        };
        await vscode.tasks.executeTask(task);
    }
}
