import * as vscode from 'vscode';
import type { ContainerCommands } from '../services/containerCommands';
import type { TaskFactory } from '../tasks/taskFactory';
import { assertContainerTreeItem } from '../views/treeItems/assertContainerTreeItem';

export class OpenContainerLogs {
    constructor(
        private readonly containerCommands: ContainerCommands,
        private readonly taskFactory: TaskFactory,
    ) {}

    public async openContainerLogsCommandHandler(
        treeNode: unknown,
    ): Promise<void> {
        assertContainerTreeItem(treeNode);
        const item = treeNode.containerItem;
        const command = this.containerCommands.getLogsCommand(
            item.id,
            item.target,
        );
        const shellCommand =
            process.platform === 'win32'
                ? command
                : command.map((argument) => argument.replaceAll("'", "'\\''"));
        const task = this.taskFactory.createShellTask(
            `Logs: ${item.names || item.id} (${item.target})`,
            shellCommand,
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
