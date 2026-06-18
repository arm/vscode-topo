import * as vscode from 'vscode';
import os from 'node:os';
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

function getProcessExecutionCwd(cwd: string | undefined): string | undefined {
    const hasWorkspace = (vscode.workspace.workspaceFolders?.length ?? 0) > 0;
    if (cwd || hasWorkspace) {
        return cwd;
    }

    return os.homedir();
}

export function createProcessTask(
    taskName: string,
    command: string[],
    opts?: TaskOptions,
): vscode.Task {
    const [cmd, ...args] = command;
    if (!cmd) {
        throw new Error('No command passed to task');
    }

    const taskDefinition: vscode.TaskDefinition = {
        type: 'process',
    };

    const processExecution = new vscode.ProcessExecution(cmd, args, {
        cwd: getProcessExecutionCwd(opts?.cwd),
    });

    const taskScope = getTaskScope(opts?.cwd);
    const task = new vscode.Task(
        taskDefinition,
        taskScope,
        taskName,
        PACKAGE_NAME,
        processExecution,
    );
    task.presentationOptions = {
        reveal: vscode.TaskRevealKind.Always,
        echo: true,
        focus: true,
        showReuseMessage: true,
        clear: true,
    };
    return task;
}

export function waitForTaskProcess(
    taskExecution: vscode.TaskExecution,
    taskName = taskExecution.task.name,
): Promise<void> {
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
