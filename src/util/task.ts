import * as vscode from 'vscode';
import { PACKAGE_NAME } from '../manifest';

type TaskExecution = vscode.ShellExecution | vscode.CustomExecution;

export function shellQuote(value: string): vscode.ShellQuotedString {
    return { value, quoting: vscode.ShellQuoting.Strong };
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

export function createTask(
    taskName: string,
    execution: TaskExecution,
    definition: vscode.TaskDefinition = { type: 'shell' },
): vscode.Task {
    const cwd = 'options' in execution ? execution.options?.cwd : undefined;
    const taskScope = getTaskScope(cwd);
    const task = new vscode.Task(
        definition,
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

export async function runTask(task: vscode.Task): Promise<void> {
    const taskExecution = await vscode.tasks.executeTask(task);
    await waitForTaskProcess(taskExecution, task.name);
}

function waitForTaskProcess(
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
