import * as vscode from 'vscode';
import { DISPLAY_NAME, PACKAGE_NAME } from '../manifest';
import { TargetStore } from '../workloadPlacement/targetStore';
import { TargetTreeDependencyItem } from '../workloadPlacement/targetTreeDependencyItem';
import { showAndLogError } from '../util/showAndLogError';
import { ContainersManager } from '../workloadPlacement/containersManager';
import { HealthCheckDependency } from '../topoCliSchema';
import { isWrappedError, WrappedError } from '../errors/wrappedError';
import { logger } from '../util/logger';

const getInstallCommand = (sshTarget: string, value: string): string[] => {
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
                new WrappedError(
                    'CLI',
                    `install ${value} failed with exit code ${e.exitCode ?? 'unknown'}`,
                ),
            );
        });
    });
};

const fixCommandRegex = /^run `topo install ([A-z-]+)`$/;

export const getInstallableDependency = (
    dependency: HealthCheckDependency,
): string | undefined => {
    if (typeof dependency.fix !== 'string') {
        return undefined;
    }

    const match = dependency.fix.match(fixCommandRegex);
    return match ? match[1] : undefined;
};

const installAction = { title: 'Install missing dependencies' };

export class InstallDependency implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];
    private targetChangedAbortController: AbortController | undefined;
    public static readonly installDependencyCommand = `${PACKAGE_NAME}.installDependency`;

    constructor(
        private readonly targetStore: TargetStore,
        private readonly containersManager: ContainersManager,
    ) {}

    public activate(): Promise<void> {
        this.disposables.push(
            vscode.commands.registerCommand(
                InstallDependency.installDependencyCommand,
                this.installDependencyFromTreeItem.bind(this),
            ),
            this.targetStore.onChanged(
                this.promptToInstallMissingDependencies.bind(this),
            ),
        );

        return this.promptToInstallMissingDependencies();
    }

    private async promptToInstallMissingDependencies(): Promise<void> {
        this.targetChangedAbortController?.abort();
        const abortController = new AbortController();
        this.targetChangedAbortController = abortController;

        const target = await this.targetStore.getSelectedTarget();
        if (!target) {
            return;
        }
        const { health } = await this.containersManager.getTargetState(target);
        const installables = [
            ...new Set(
                health?.dependencies
                    .map(getInstallableDependency)
                    .filter((v) => typeof v === 'string'),
            ),
        ];

        if (installables.length > 0 && !abortController.signal.aborted) {
            await this.showInstallableNotification(target, installables);
        }
    }

    private async installDependencyFromTreeItem(
        treeNode: unknown,
    ): Promise<void> {
        if (!(treeNode instanceof TargetTreeDependencyItem)) {
            const errMsg = `Invalid target type for install dependency: expected TargetTreeDependencyItem but received:`;
            logger.error(errMsg, treeNode);
            return;
        }

        const target = await this.targetStore.getSelectedTarget();
        if (!target) {
            return;
        }

        const installable = getInstallableDependency(treeNode.dependency);
        if (!installable) {
            return;
        }

        await this.installDependency(target, installable);
    }

    private async installDependency(
        target: string,
        installable: string,
    ): Promise<void> {
        try {
            await runInstallTask(target, installable);
            vscode.window.showInformationMessage(
                `${installable} was installed on target ${target}`,
            );
        } catch (err) {
            if (isWrappedError(err, ['CLI'])) {
                return showAndLogError(
                    `Failed to install ${installable} on target ${target}`,
                    err,
                );
            }

            throw err;
        }
    }

    private async showInstallableNotification(
        target: string,
        installables: string[],
    ): Promise<void> {
        const choice = await vscode.window.showWarningMessage(
            `${target} has missing or unhealthy dependencies: ${installables.join(`, `)}`,
            installAction,
        );
        if (choice?.title === installAction.title) {
            for (const installable of installables) {
                await this.installDependency(target, installable);
            }
        }
    }

    public dispose(): void {
        this.targetChangedAbortController?.abort();
        this.targetChangedAbortController = undefined;
        for (const disposable of [...this.disposables].reverse()) {
            disposable.dispose();
        }
        this.disposables = [];
    }
}
