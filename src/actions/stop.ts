import * as vscode from 'vscode';
import { getErrorMessage } from '../util/getErrorMessage';
import path from 'node:path';
import { createProcessTask } from '../util/task';
import { TaskExecutor } from '../util/taskExecutor';
import { showAndLogError } from '../util/showAndLogError';
import { TargetModel } from '../models/targetModel';
import { TargetController } from '../controllers/targetController';

const viewLogsItem: vscode.MessageItem = {
    title: 'View Logs',
};

export class Stop {
    constructor(
        private readonly taskExecutor: TaskExecutor,
        private readonly targetModel: TargetModel,
        private readonly targetController: TargetController,
    ) {}

    public async stopCommandHandler(resource?: vscode.Uri): Promise<void> {
        if (!resource) {
            throw new Error('No compose.yaml or compose.yml selected for stop');
        }
        const target = this.targetModel.selected;

        if (!target) {
            showAndLogError(
                'Error executing stop command',
                new Error(
                    'No target selected. Please select a target before stopping.',
                ),
            );
            return;
        }

        await stop(this.taskExecutor, resource.fsPath, target);
        await this.targetController.refreshSelectedTargetDataCommandHandler();
    }
}

export async function stop(
    taskExecutor: TaskExecutor,
    composeFilePath: string,
    target: string,
): Promise<void> {
    const task = createStopTask(composeFilePath, target);
    const taskName = task.name;

    try {
        await taskExecutor.run(task);
        vscode.window.showInformationMessage(
            `Services on ${target} stopped successfully.`,
        );
    } catch (e) {
        const terminal = vscode.window.terminals.find(
            (t) => t.name === taskName,
        );
        const actions: vscode.MessageItem[] = [];
        if (terminal) {
            actions.push(viewLogsItem);
        }
        const choice = await vscode.window.showErrorMessage(
            `Stopping services on ${target} failed: ${getErrorMessage(e)}`,
            ...actions,
        );
        if (choice?.title === viewLogsItem.title) {
            terminal?.show();
        }
    }
}

export function createStopTask(
    composeFilePath: string,
    target: string,
): vscode.Task {
    return createProcessTask(
        `Stop services on ${target}`,
        ['topo', 'stop', '--target', target],
        {
            cwd: path.dirname(composeFilePath),
        },
    );
}
