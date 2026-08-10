import * as vscode from 'vscode';
import os from 'node:os';
import { PACKAGE_NAME } from '../manifest';

export interface TaskOptions {
    cwd?: string;
    definition?: vscode.TaskDefinition;
}

export type TaskExecution =
    vscode.ProcessExecution | vscode.ShellExecution | vscode.CustomExecution;

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

    const processExecution = new vscode.ProcessExecution(cmd, args, {
        cwd: getProcessExecutionCwd(opts?.cwd),
    });

    return createTask(taskName, processExecution, opts);
}

export function createTask(
    taskName: string,
    execution: TaskExecution,
    opts?: TaskOptions,
): vscode.Task {
    const taskDefinition: vscode.TaskDefinition = opts?.definition ?? {
        type: 'process',
    };

    const taskScope = getTaskScope(opts?.cwd);
    const task = new vscode.Task(
        taskDefinition,
        taskScope,
        taskName,
        PACKAGE_NAME,
        execution,
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

export function withTaskExecution(
    task: vscode.Task,
    execution: TaskExecution,
): vscode.Task {
    const resolvedTask = new vscode.Task(
        task.definition,
        task.scope ?? vscode.TaskScope.Workspace,
        task.name,
        task.source,
        execution,
        task.problemMatchers,
    );
    resolvedTask.presentationOptions = task.presentationOptions;
    resolvedTask.group = task.group;
    resolvedTask.isBackground = task.isBackground;
    resolvedTask.runOptions = task.runOptions;
    resolvedTask.detail = task.detail;
    return resolvedTask;
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
