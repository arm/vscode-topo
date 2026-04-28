import * as vscode from 'vscode';
import { PACKAGE_NAME } from '../manifest';
import { TargetStore } from '../workloadPlacement/targetStore';
import { TargetTreeTargetItem } from '../workloadPlacement/targetTreeTargetItem';
import { showAndLogError } from '../util/showAndLogError';

export class SetupKeys {
    public static readonly setupKeysCommand = `${PACKAGE_NAME}.setupKeys`;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly targetStore: TargetStore,
    ) {}

    public activate(): void {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                SetupKeys.setupKeysCommand,
                (treeNode: unknown) => this.setupKeys(treeNode),
            ),
        );
    }

    private async setupKeys(treeNode: unknown): Promise<void> {
        let ssh: string | undefined;

        if (treeNode instanceof TargetTreeTargetItem) {
            if (!treeNode.contextValue?.includes('Selected')) {
                return;
            }
            ssh = treeNode.target;
        } else {
            const selectedTarget = await this.targetStore.getSelectedTarget();
            if (!selectedTarget) {
                showAndLogError(
                    'Failed to set up keys on target',
                    new Error('No selected target found'),
                );
                return;
            }
            ssh = selectedTarget;
        }
        if (!ssh) {
            return;
        }

        try {
            await this.runSetupKeysTask(ssh);
            vscode.window.showInformationMessage(
                `Keys were set up on target ${ssh}.`,
            );
        } catch (err) {
            showAndLogError(`Failed to set up keys on target ${ssh}`, err);
        }
    }

    private async runSetupKeysTask(sshTarget: string): Promise<void> {
        const setupKeysCommand = ['topo', 'setup-keys', '--target', sshTarget];
        const [cmd, ...cmdArgs] = setupKeysCommand;
        const shellExecution = new vscode.ShellExecution(cmd, cmdArgs);
        const taskDefinition: vscode.TaskDefinition = {
            type: 'shell',
            taskId: `${PACKAGE_NAME} setup-keys`,
        };
        const task = new vscode.Task(
            taskDefinition,
            vscode.TaskScope.Workspace,
            `Setup keys on ${sshTarget}`,
            PACKAGE_NAME,
            shellExecution,
        );
        task.presentationOptions = {
            reveal: vscode.TaskRevealKind.Always,
            echo: true,
            focus: true,
            showReuseMessage: true,
            clear: false,
        };
        const taskExecution = await vscode.tasks.executeTask(task);

        await new Promise<void>((resolve, reject) => {
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
                            `setup-keys failed with exit code ${e.exitCode ?? 'unknown'}`,
                        ),
                    );
                }
            });
        });
    }
}
