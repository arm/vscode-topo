import * as vscode from 'vscode';
import * as manifest from '../manifest';
import { getErrorMessage } from '../util/getErrorMessage';
import path from 'node:path';
import { executeTask } from '../util/executeTask';
import { showAndLogError } from '../util/showAndLogError';
import { TargetModel } from '../models/targetModel';

const viewLogsItem: vscode.MessageItem = {
    title: 'View Logs',
};

export class Deploy {
    public static readonly deployCommand = `${manifest.PACKAGE_NAME}.deploy.context`;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly targetModel: TargetModel,
    ) {}

    public activate(): void {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                Deploy.deployCommand,
                this.deployCommandHandler.bind(this),
            ),
        );
    }

    private async deployCommandHandler(resource?: vscode.Uri): Promise<void> {
        if (!resource) {
            throw new Error('No compose file selected for deployment');
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

        await deploy(resource.fsPath, target);
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
