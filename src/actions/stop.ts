import * as vscode from 'vscode';
import { getErrorMessage } from '../util/getErrorMessage';
import { TaskExecutor } from '../util/taskExecutor';
import { showAndLogWarning } from '../util/showAndLog';
import { TargetModel } from '../models/targetModel';
import { ProjectController } from '../controllers/projectController';
import { assertProjectTreeItem } from '../views/treeItems/assertProjectTreeItem';
import { isWrappedError } from '../errors/wrappedError';
import {
    assertTargetConnected,
    assertTargetSelected,
} from '../util/assertTargetReady';
import { TopoStopTaskFactory } from '../tasks/topoStopTaskFactory';
import type { TopoComposeTaskInvocation } from '../tasks/topoComposeTask';

const viewLogsItem: vscode.MessageItem = {
    title: 'View Logs',
};

export class Stop {
    constructor(
        private readonly taskExecutor: TaskExecutor,
        private readonly targetModel: TargetModel,
        private readonly projectController: ProjectController,
        private readonly stopTaskFactory: TopoStopTaskFactory,
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

        await stop(this.taskExecutor, this.stopTaskFactory, {
            target,
            composeFilePath: resource.fsPath,
        });
        await this.projectController.refreshProjectContainersCommandHandler();
    }

    public async stopProjectCommandHandler(treeNode: unknown): Promise<void> {
        assertProjectTreeItem(treeNode);
        await this.stopCommandHandler(treeNode.composeFileUri);
    }
}

export async function stop(
    taskExecutor: TaskExecutor,
    stopTaskFactory: TopoStopTaskFactory,
    invocation: TopoComposeTaskInvocation,
): Promise<void> {
    const { target } = invocation;
    const task = stopTaskFactory.createTask(invocation);
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
