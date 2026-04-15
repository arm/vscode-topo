import * as vscode from 'vscode';
import { logger } from '../util/logger';
import * as manifest from '../manifest';
import { getErrorMessage } from '../util/getErrorMessage';
import path from 'node:path';
import { TargetItem } from '../util/types';
import { TargetStore } from '../workloadPlacement/targetStore';

const viewLogsItem: vscode.MessageItem = {
    title: 'View Logs',
};

const executeDeployTask = async (
    composeFilePath: string,
    target: TargetItem,
): Promise<vscode.Disposable> => {
    const cwd = path.dirname(composeFilePath);
    const shellExecution = new vscode.ShellExecution(
        'topo',
        ['deploy', '--target', target.ssh],
        {
            cwd,
        },
    );
    const workspace = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(cwd));
    const taskScope = workspace ?? vscode.TaskScope.Workspace;
    const taskDefinition: vscode.TaskDefinition = {
        type: 'shell',
        taskId: `${manifest.PACKAGE_NAME} deploy`,
    };
    const task = new vscode.Task(
        taskDefinition,
        taskScope,
        `Deploy to ${target.ssh}`,
        manifest.DISPLAY_NAME,
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
    const taskEndDisposable = vscode.tasks.onDidEndTaskProcess(async (e) => {
        if (e.execution !== taskExecution) {
            return;
        }

        taskEndDisposable.dispose();

        if (e.exitCode === 0) {
            vscode.window.showInformationMessage(
                `Deployment to ${target.ssh} completed successfully.`,
            );
        } else {
            const terminal = vscode.window.terminals.find(
                (t) => t.name === task.name,
            );
            const actions: vscode.MessageItem[] = [];
            if (terminal) {
                actions.push(viewLogsItem);
            }
            const choice = await vscode.window.showErrorMessage(
                `Deployment to ${target.ssh} failed with exit code ${e.exitCode}.`,
                ...actions,
            );
            if (choice?.title === viewLogsItem.title) {
                terminal?.show();
            }
        }
    });
    return taskEndDisposable;
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
        try {
            await this.deploy(resource.fsPath);
        } catch (err) {
            const errorMsg = 'Error executing deploy command';
            logger.error(errorMsg, err);
            void vscode.window.showErrorMessage(
                `${errorMsg}: ${getErrorMessage(err)}`,
            );
        }
    }

    public async deploy(composeFilePath: string): Promise<void> {
        const target = await this.targetStore.getSelectedTarget();
        if (!target) {
            throw new Error(
                'No target selected. Please select a target before deploying.',
            );
        }

        const deployTask = await executeDeployTask(composeFilePath, target);
        this.context.subscriptions.push(deployTask);
    }
}
