import path from 'node:path';
import * as vscode from 'vscode';
import { getErrorMessage } from '../util/getErrorMessage';
import { runTask } from '../util/task';
import { showAndLogWarning } from '../util/showAndLog';
import { TargetModel } from '../models/targetModel';
import { assertProjectTreeItem } from '../views/treeItems/assertProjectTreeItem';
import { isWrappedError } from '../errors/wrappedError';
import {
    assertTargetConnected,
    assertTargetSelected,
} from '../util/assertTargetReady';
import { TOPO_TASK_TYPE } from '../manifest';
import {
    TaskCommand,
    type TaskDefinition,
    type TaskFactory,
} from '../tasks/taskFactory';
import { COMPOSE_FILE_NAME } from '../util/composeFile';

const viewLogsItem: vscode.MessageItem = {
    title: 'View Logs',
};

export class Stop {
    constructor(
        private readonly targetModel: TargetModel,
        private readonly taskFactory: TaskFactory,
    ) {}

    public async stopCommandHandler(resource?: vscode.Uri): Promise<void> {
        if (!resource) {
            throw new Error('No compose.yaml selected for stop');
        }

        const target = this.targetModel.selected;
        const health = this.targetModel.selectedTargetHealth;
        try {
            assertTargetSelected(target);
            assertTargetConnected(target, health);
        } catch (err: unknown) {
            if (isWrappedError(err, ['TARGET'])) {
                showAndLogWarning('Cannot stop', err);
                return;
            }
            throw err;
        }

        await stop(this.taskFactory, resource.fsPath, target);
    }

    public async stopProjectCommandHandler(treeNode: unknown): Promise<void> {
        assertProjectTreeItem(treeNode);
        await this.stopCommandHandler(treeNode.composeFileUri);
    }
}

export async function stop(
    taskFactory: TaskFactory,
    composeFile: string,
    target: string,
): Promise<void> {
    const definition: TaskDefinition = {
        type: TOPO_TASK_TYPE,
        command: TaskCommand.Stop,
        args: ['--file', COMPOSE_FILE_NAME, '--target', target],
        options: { cwd: path.dirname(composeFile) },
    };
    const task = taskFactory.createTask(
        `Stop ${composeFile} on ${target}`,
        definition,
    );
    const taskName = task.name;

    try {
        await runTask(task);
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
        return;
    }
    vscode.window.showInformationMessage(
        `Services on ${target} stopped successfully.`,
    );
}
