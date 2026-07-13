import * as vscode from 'vscode';
import { getErrorMessage } from '../util/getErrorMessage';
import path from 'node:path';
import { createProcessTask } from '../util/task';
import { TaskExecutor } from '../util/taskExecutor';
import { showAndLogWarning } from '../util/showAndLog';
import { TargetModel } from '../models/targetModel';
import { ProjectController } from '../controllers/projectController';
import { ProjectTreeItem } from '../views/treeItems/projectTreeItem';
import { isWrappedError } from '../errors/wrappedError';
import { selectComposeFile } from '../util/composeFile';
import {
    assertTargetConnected,
    assertTargetSelected,
} from '../util/assertTargetReady';

const viewLogsItem: vscode.MessageItem = {
    title: 'View Logs',
};

export class Stop {
    constructor(
        private readonly taskExecutor: TaskExecutor,
        private readonly targetModel: TargetModel,
        private readonly projectController: ProjectController,
    ) {}

    public async stopCommandHandler(resource?: vscode.Uri): Promise<void> {
        if (!resource) {
            throw new Error('No Compose file selected for stop');
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

        await stop(this.taskExecutor, resource.fsPath, target);
        await this.projectController.refreshProjectContainersCommandHandler();
    }

    public async stopProjectCommandHandler(treeNode: unknown): Promise<void> {
        if (!(treeNode instanceof ProjectTreeItem)) {
            throw new Error('No Compose file selected for stop');
        }

        const resource = await selectComposeFile(
            treeNode.project.composeFileUris,
            'Select a Compose file to stop',
        );
        if (!resource) {
            return;
        }

        await this.stopCommandHandler(resource);
    }
}

export async function stop(
    taskExecutor: TaskExecutor,
    composeFilePath: string,
    target: string,
): Promise<void> {
    const task = createProcessTask(
        `Stop services on ${target}`,
        [
            'topo',
            'stop',
            '--target',
            target,
            '-f',
            path.basename(composeFilePath),
        ],
        {
            cwd: path.dirname(composeFilePath),
        },
    );
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
