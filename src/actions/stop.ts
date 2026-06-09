import * as vscode from 'vscode';
import { getErrorMessage } from '../util/getErrorMessage';
import path from 'node:path';
import { executeTask } from '../util/executeTask';
import { showAndLogError } from '../util/showAndLogError';
import { TargetModel } from '../models/targetModel';
import { TopoCli } from '../topoCli';

const viewLogsItem: vscode.MessageItem = {
    title: 'View Logs',
};

export class Stop {
    constructor(
        private readonly topoCli: TopoCli,
        private readonly targetModel: TargetModel,
    ) {}

    public async stopCommandHandler(resource?: vscode.Uri): Promise<void> {
        if (!resource) {
            throw new Error('No compose.yaml or compose.yml selected for stop');
        }
        const target = this.targetModel.selected;

        if (!target) {
            showAndLogError(
                'Error executing stop command',
                new Error(
                    'No target selected. Please select a target before stopping.',
                ),
            );
            return;
        }

        await stop(this.topoCli, resource.fsPath, target);
    }
}

export async function stop(
    topoCli: TopoCli,
    composeFilePath: string,
    target: string,
): Promise<void> {
    const taskName = `Stop services on ${target}`;

    try {
        await executeTask(taskName, topoCli.buildStopCommand(target), {
            cwd: path.dirname(composeFilePath),
        });
        vscode.window.showInformationMessage(
            `Services on ${target} stopped successfully.`,
        );
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
    }
}
