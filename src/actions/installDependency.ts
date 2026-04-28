import * as vscode from 'vscode';
import { DISPLAY_NAME, PACKAGE_NAME } from '../manifest';
import { TargetStore } from '../workloadPlacement/targetStore';
import { TargetTreeDependencyItem } from '../workloadPlacement/targetTreeDependencyItem';
import { showAndLogError } from '../util/showAndLogError';

type TopoCliCommand = [string, ...string[]];

const getInstallCommand = (
    sshTarget: string,
    value: string,
): TopoCliCommand => {
    return ['topo', 'install', value, '--target', sshTarget];
};

const runInstallTask = async (
    sshTarget: string,
    value: string,
): Promise<void> => {
    const [cmd, ...cmdArgs] = getInstallCommand(sshTarget, value);
    const shellExecution = new vscode.ShellExecution(cmd, cmdArgs);
    const taskDefinition: vscode.TaskDefinition = {
        type: 'shell',
        taskId: `${PACKAGE_NAME} install ${value}`,
    };
    const task = new vscode.Task(
        taskDefinition,
        vscode.TaskScope.Workspace,
        `Install ${value} on ${sshTarget}`,
        DISPLAY_NAME,
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
                return;
            }

            reject(
                new Error(
                    `install ${value} failed with exit code ${e.exitCode ?? 'unknown'}`,
                ),
            );
        });
    });
};

const getInstallableDependency = (treeNode: unknown): string | undefined => {
    if (!(treeNode instanceof TargetTreeDependencyItem)) {
        return undefined;
    }

    return treeNode.installableDependency;
};

export class InstallDependency {
    public static readonly installDependencyCommand = `${PACKAGE_NAME}.installDependency`;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly targetStore: TargetStore,
    ) {}

    public activate(): void {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                InstallDependency.installDependencyCommand,
                (treeNode: unknown) => this.install(treeNode),
            ),
        );
    }

    private async install(treeNode: unknown): Promise<void> {
        const installable = getInstallableDependency(treeNode);
        if (!installable) {
            return;
        }

        const sshTarget = await this.targetStore.getSelectedTarget();
        if (!sshTarget) {
            showAndLogError(
                `Failed to install ${installable}`,
                new Error('No selected target found'),
            );
            return;
        }

        try {
            await runInstallTask(sshTarget, installable);
            vscode.window.showInformationMessage(
                `${installable} was installed on target ${sshTarget}.`,
            );
        } catch (err) {
            showAndLogError(
                `Failed to install ${installable} on target ${sshTarget}`,
                err,
            );
        }
    }
}
