import * as vscode from 'vscode';
import * as manifest from '../manifest';
import { getErrorMessage } from '../util/getErrorMessage';
import path from 'node:path';
import { TargetStore } from '../target/targetStore';
import { executeTask } from '../util/executeTask';
import { showAndLogError } from '../util/showAndLogError';
import { isWrappedError, WrappedError } from '../errors/wrappedError';

const viewLogsItem: vscode.MessageItem = {
    title: 'View Logs',
};

export class Deploy {
    public static readonly deployCommand = `${manifest.PACKAGE_NAME}.deploy.context`;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly targetStore: TargetStore,
    ) {}

    public activate(): void {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                Deploy.deployCommand,
                this.handleDeployCommand.bind(this),
            ),
        );
    }

    private async handleDeployCommand(resource?: vscode.Uri): Promise<void> {
        if (!resource) {
            throw new Error('No compose file selected for deployment');
        }
        let target: string | undefined;

        try {
            target = await this.targetStore.getSelectedTarget();
        } catch (err) {
            if (isWrappedError(err, ['TARGET'])) {
                showAndLogError('Error executing deploy command', err);
                return;
            }
            throw err;
        }

        if (!target) {
            showAndLogError(
                'Error executing deploy command',
                new WrappedError(
                    'TARGET',
                    'No target selected. Please select a target before deploying.',
                ),
            );
            return;
        }

        await this.deploy(resource.fsPath, target);
    }

    public async deploy(
        composeFilePath: string,
        target: string,
    ): Promise<void> {
        const taskName = `Deploy to ${target}`;

        try {
            await executeTask(
                taskName,
                ['topo', 'deploy', '--target', target],
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
}
