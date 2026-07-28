import path from 'node:path';
import * as vscode from 'vscode';
import { getErrorMessage } from '../util/getErrorMessage';
import { createProcessTask } from '../util/task';
import { TaskExecutor } from '../util/taskExecutor';
import { assertProjectTreeItem } from './util/assertProjectTreeItem';

const viewLogsItem: vscode.MessageItem = {
    title: 'View Logs',
};

export class Configure {
    constructor(private readonly taskExecutor: TaskExecutor) {}

    public async configureContextCommandHandler(
        resource?: vscode.Uri,
    ): Promise<void> {
        if (!resource) {
            throw new Error(
                'No compose.yaml or compose.yml selected for configuration',
            );
        }

        await configure(this.taskExecutor, resource.fsPath);
    }

    public async configureProjectCommandHandler(
        treeNode: unknown,
    ): Promise<void> {
        assertProjectTreeItem(treeNode);
        await this.configureContextCommandHandler(treeNode.composeFileUri);
    }
}

export async function configure(
    taskExecutor: TaskExecutor,
    composeFilePath: string,
): Promise<void> {
    const projectName = path.basename(path.dirname(composeFilePath));
    const task = createProcessTask(
        `Configure ${projectName}`,
        ['topo', 'configure', '--file', path.basename(composeFilePath)],
        {
            cwd: path.dirname(composeFilePath),
        },
    );
    const taskName = task.name;

    try {
        await taskExecutor.run(task);
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
