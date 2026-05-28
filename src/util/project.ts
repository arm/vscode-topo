import * as vscode from 'vscode';
import { executeTask } from '../util/executeTask';
import path from 'node:path';
import { getErrorMessage } from '../util/getErrorMessage';
import { TopoCli } from '../topoCli';

const viewLogsItem: vscode.MessageItem = {
    title: 'View Logs',
};

async function showTaskFailureMessage(
    taskName: string,
    message: string,
): Promise<void> {
    const terminal = vscode.window.terminals.find((t) => t.name === taskName);
    const actions: vscode.MessageItem[] = [];
    if (terminal) {
        actions.push(viewLogsItem);
    }
    const choice = await vscode.window.showErrorMessage(message, ...actions);
    if (choice?.title === viewLogsItem.title) {
        terminal?.show();
    }
}

export async function stop(
    composeFilePath: string,
    target: string,
): Promise<void> {
    const taskName = `Stop services on ${target}`;

    try {
        await executeTask(taskName, ['topo', 'stop', '--target', target], {
            cwd: path.dirname(composeFilePath),
        });
        vscode.window.showInformationMessage(
            `Services on ${target} stopped successfully.`,
        );
    } catch (e) {
        await showTaskFailureMessage(
            taskName,
            `Stopping services on ${target} failed: ${getErrorMessage(e)}`,
        );
    }
}

export async function initProject(
    topoCli: TopoCli,
    projectPath: string,
): Promise<void> {
    try {
        await topoCli.init(projectPath);
        vscode.window.showInformationMessage(
            `Project initialized successfully.`,
        );
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(
            `Failed to initialize project: ${errorMsg}`,
        );
    }
}

export async function deploy(
    composeFilePath: string,
    target: string,
): Promise<void> {
    const taskName = `Deploy to ${target}`;

    try {
        await executeTask(taskName, ['topo', 'deploy', '--target', target], {
            cwd: path.dirname(composeFilePath),
        });
        vscode.window.showInformationMessage(
            `Deployment to ${target} completed successfully.`,
        );
    } catch (e) {
        await showTaskFailureMessage(
            taskName,
            `Deployment to ${target} failed: ${getErrorMessage(e)}`,
        );
    }
}
