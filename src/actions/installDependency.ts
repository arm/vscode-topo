import * as vscode from 'vscode';
import { PACKAGE_NAME } from '../manifest';
import { TargetStore } from '../target/targetStore';
import { HealthCheckDependencyTreeItem } from '../treeItems/healthCheckDependencyTreeItem';
import { showAndLogError } from '../util/showAndLogError';
import { ContainersManager } from '../target/containersManager';
import { logger } from '../util/logger';
import { executeTask } from '../util/executeTask';

const installAction = { title: 'Install missing dependencies' };

type InstallableDependency = {
    names: string[];
    command: string;
};

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

        const target = this.targetStore.getSelectedTarget();
        if (!target) {
            return;
        }
        const { health } = await this.containersManager.getTargetState(target);

        const installables = new Map<string, InstallableDependency>();
        for (const dependency of health?.dependencies ?? []) {
            const command = dependency.fix?.command;
            if (command) {
                const installable = installables.get(command);
                if (installable) {
                    installable.names.push(dependency.name);
                } else {
                    installables.set(command, {
                        names: [dependency.name],
                        command,
                    });
                }
            }
        }

        if (installables.size > 0 && !abortController.signal.aborted) {
            await this.showInstallableNotification(target, [
                ...installables.values(),
            ]);
        }
    }

    private async installDependencyFromTreeItem(
        treeNode: unknown,
    ): Promise<void> {
        if (!(treeNode instanceof HealthCheckDependencyTreeItem)) {
            const errMsg = `Invalid dependency item for install dependency: expected HealthCheckDependencyTreeItem but received:`;
            logger.error(errMsg, treeNode);
            return;
        }

        const target = this.targetStore.getSelectedTarget();
        if (!target) {
            showAndLogError(
                `Failed to install dependency`,
                new Error('No selected target found'),
            );
            return;
        }

        const command = treeNode.dependency.fix?.command;
        if (!command) {
            showAndLogError(
                `Failed to install dependency`,
                new Error(
                    'No installable dependency found for the selected item',
                ),
            );
            return;
        }

        await this.installDependency(
            target,
            [treeNode.dependency.name],
            command,
        );
    }

    private async installDependency(
        target: string,
        names: string[],
        command: string,
    ): Promise<void> {
        const name = names.join(', ');
        try {
            await executeTask(`Install ${name} on ${target}`, command);
            vscode.window.showInformationMessage(
                `${name} was installed on target ${target}`,
            );
        } catch (err) {
            showAndLogError(
                `Failed to install ${name} on target ${target}`,
                err,
            );
        }
    }

    private async showInstallableNotification(
        target: string,
        installables: InstallableDependency[],
    ): Promise<void> {
        const choice = await vscode.window.showWarningMessage(
            `${target} has missing or unhealthy dependencies: ${installables.flatMap(({ names }) => names).join(`, `)}`,
            installAction,
        );
        if (choice?.title === installAction.title) {
            for (const installable of installables) {
                await this.installDependency(
                    target,
                    installable.names,
                    installable.command,
                );
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
