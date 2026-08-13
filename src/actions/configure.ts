import path from 'node:path';
import * as vscode from 'vscode';
import { getErrorMessage } from '../util/getErrorMessage';
import { assertComposeFilePath, COMPOSE_FILE_NAME } from '../util/composeFile';
import { runTask } from '../util/task';
import { assertProjectTreeItem } from '../views/treeItems/assertProjectTreeItem';
import { TOPO_TASK_TYPE } from '../manifest';
import {
    TaskCommand,
    type TaskDefinition,
    type TaskFactory,
} from '../tasks/taskFactory';

const viewLogsItem: vscode.MessageItem = {
    title: 'View Logs',
};

export class Configure {
    constructor(private readonly taskFactory: TaskFactory) {}

    public async configureContextCommandHandler(
        resource?: vscode.Uri,
    ): Promise<void> {
        if (!resource) {
            throw new Error('No compose.yaml selected for configuration');
        }

        await configure(this.taskFactory, resource.fsPath);
    }

    public async configureProjectCommandHandler(
        treeNode: unknown,
    ): Promise<void> {
        assertProjectTreeItem(treeNode);
        await this.configureContextCommandHandler(treeNode.composeFileUri);
    }
}

export async function configure(
    taskFactory: TaskFactory,
    composeFilePath: string,
): Promise<void> {
    assertComposeFilePath(composeFilePath);
    const composeFileDir = path.dirname(composeFilePath);
    const projectName = path.basename(composeFileDir);
    const definition: TaskDefinition = {
        type: TOPO_TASK_TYPE,
        command: TaskCommand.Configure,
        args: ['--file', COMPOSE_FILE_NAME],
        options: { cwd: composeFileDir },
    };
    const task = taskFactory.createTask(`Configure ${projectName}`, definition);
    const taskName = task.name;

    try {
        await runTask(task);
    } catch (error: unknown) {
        const terminal = vscode.window.terminals.find(
            (candidate) => candidate.name === taskName,
        );
        const actions: vscode.MessageItem[] = [];
        if (terminal) {
            actions.push(viewLogsItem);
        }
        const choice = await vscode.window.showErrorMessage(
            `Configuring ${projectName} failed: ${getErrorMessage(error)}`,
            ...actions,
        );
        if (choice?.title === viewLogsItem.title) {
            terminal?.show();
        }
        return;
    }

    vscode.window.showInformationMessage(
        `${projectName} configured successfully.`,
    );
}
