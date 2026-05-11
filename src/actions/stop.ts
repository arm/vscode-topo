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

export class Stop {
    public static readonly stopCommand = `${manifest.PACKAGE_NAME}.stop.context`;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly targetStore: TargetStore,
    ) {}

    public activate(): void {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                Stop.stopCommand,
                this.handleStopCommand.bind(this),
            ),
        );
    }

    private async handleStopCommand(resource?: vscode.Uri): Promise<void> {
        if (!resource) {
            throw new Error('No compose file selected for stop');
        }
        let target: string | undefined;

        try {
            target = await this.targetStore.getSelectedTarget();
        } catch (err) {
            if (isWrappedError(err, ['TARGET'])) {
                showAndLogError('Error executing stop command', err);
                return;
            }
            throw err;
        }

        if (!target) {
            showAndLogError(
                'Error executing stop command',
                new WrappedError(
                    'TARGET',
                    'No target selected. Please select a target before stopping.',
                ),
            );
            return;
        }

        await this.stop(resource.fsPath, target);
    }

    public async stop(composeFilePath: string, target: string): Promise<void> {
        const taskName = `Stop services on ${target}`;

        try {
            await executeTask(taskName, ['topo', 'stop', '--target', target], {
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
}
