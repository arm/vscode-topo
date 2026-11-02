import path from 'node:path';
import * as vscode from 'vscode';
import { TOPO_TASK_TYPE } from '../manifest';
import { TaskCommand, type TaskFactory } from '../tasks/taskFactory';

export async function openLogs(
    taskFactory: TaskFactory,
    name: string,
    composeFilePath: string,
    target: string,
    services: readonly string[] = [],
): Promise<void> {
    const task = taskFactory.createTask(name, {
        type: TOPO_TASK_TYPE,
        command: TaskCommand.Logs,
        args: [
            '--file',
            path.basename(composeFilePath),
            '--target',
            target,
            '--follow',
            '--',
            ...services,
        ],
        options: { cwd: path.dirname(composeFilePath) },
    });
    // Keep completed logs visible, including those from stopped containers.
    task.presentationOptions = {
        ...task.presentationOptions,
        panel: vscode.TaskPanelKind.Dedicated,
        close: false,
    };
    await vscode.tasks.executeTask(task);
}
