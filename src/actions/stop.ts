import * as vscode from 'vscode';
import { getErrorMessage } from '../util/getErrorMessage';
import { TaskExecutor } from '../util/taskExecutor';
import { showAndLogWarning } from '../util/showAndLog';
import { TargetModel } from '../models/targetModel';
import { assertProjectTreeItem } from '../views/treeItems/assertProjectTreeItem';
import { isWrappedError } from '../errors/wrappedError';
import {
    assertTargetConnected,
    assertTargetSelected,
} from '../util/assertTargetReady';
import type {
    TopoStopTaskDefinition,
    StopTaskFactory,
} from '../tasks/stopTaskFactory';
import { TOPO_STOP_TASK_TYPE } from '../manifest';

const viewLogsItem: vscode.MessageItem = {
    title: 'View Logs',
};

export class Stop {
    constructor(
        private readonly taskExecutor: TaskExecutor,
        private readonly targetModel: TargetModel,
        private readonly taskFactory: StopTaskFactory,
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

        const definition: TopoStopTaskDefinition = {
            type: TOPO_STOP_TASK_TYPE,
            target,
            composeFile: resource.fsPath,
        };
        await stop(this.taskExecutor, this.taskFactory, definition);
    }

    public async stopProjectCommandHandler(treeNode: unknown): Promise<void> {
        assertProjectTreeItem(treeNode);
        await this.stopCommandHandler(treeNode.composeFileUri);
    }
}

export async function stop(
    taskExecutor: TaskExecutor,
    taskFactory: StopTaskFactory,
    definition: TopoStopTaskDefinition,
): Promise<void> {
    const { target } = definition;
    const task = taskFactory.createTask(definition);
    const taskName = task.name;

    try {
        await taskExecutor.run(task);
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
