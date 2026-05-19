import * as vscode from 'vscode';
import { PACKAGE_NAME } from '../manifest';

export interface TaskOptions {
    cwd?: string;
}

function getTaskScope(
    cwd: string | undefined,
): vscode.TaskScope | vscode.WorkspaceFolder {
    if (!cwd) {
        return vscode.TaskScope.Workspace;
    }

    const workspace = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(cwd));
    return workspace ?? vscode.TaskScope.Workspace;
}

export async function executeTask(
    taskName: string,
    command: string[] | string,
    opts?: TaskOptions,
): Promise<void> {
    if (command.length === 0) {
        throw new Error('No command passed to task');
    }

    const taskDefinition: vscode.TaskDefinition = {
        type: 'shell',
    };

    const shellExecution =
        typeof command === 'string'
            ? new vscode.ShellExecution(command, {
                  cwd: opts?.cwd,
              })
            : new vscode.ShellExecution(command[0], command.slice(1), {
                  cwd: opts?.cwd,
              });

    const taskScope = getTaskScope(opts?.cwd);
    const task = new vscode.Task(
        taskDefinition,
        taskScope,
        taskName,
        PACKAGE_NAME,
        shellExecution,
    );
    task.presentationOptions = {
        reveal: vscode.TaskRevealKind.Always,
        echo: true,
        focus: true,
        showReuseMessage: true,
        clear: true,
    };
    const taskExecution = await vscode.tasks.executeTask(task);

    return new Promise<void>((resolve, reject) => {
        const disposable = vscode.tasks.onDidEndTaskProcess((e) => {
            if (e.execution !== taskExecution) {
                return;
            }
            disposable.dispose();
            if (e.exitCode === 0) {
                resolve();
            } else {
                reject(
                    new Error(
                        `${taskName} failed with exit code ${e.exitCode ?? 'unknown'}`,
                    ),
                );
            }
        });
    });
}
