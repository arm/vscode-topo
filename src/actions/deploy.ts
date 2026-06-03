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

export class Deploy {
    constructor(
        private readonly topoCli: TopoCli,
        private readonly targetModel: TargetModel,
    ) {}

    public async deployCommandHandler(resource?: vscode.Uri): Promise<void> {
        if (!resource) {
            throw new Error(
                'No compose.yaml or compose.yml selected for deployment',
            );
        }
        const target = this.targetModel.selected;

        if (!target) {
            showAndLogError(
                'Error executing deploy command',
                new Error(
                    'No target selected. Please select a target before deploying.',
                ),
            );
            return;
        }

        await deploy(this.topoCli.getBinaryPath(), resource.fsPath, target);
    }
}

export async function deploy(
    topoBinaryPath: string,
    composeFilePath: string,
    target: string,
): Promise<void> {
    const taskName = `Deploy to ${target}`;

    try {
        await executeTask(
            taskName,
            [topoBinaryPath, 'deploy', '--target', target],
            {
                cwd: path.dirname(composeFilePath),
            },
        );
        vscode.window.showInformationMessage(
            `Deployment to ${target} completed successfully.`,
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
            `Deployment to ${target} failed: ${getErrorMessage(e)}`,
            ...actions,
        );
        if (choice?.title === viewLogsItem.title) {
            terminal?.show();
        }
    }
}
