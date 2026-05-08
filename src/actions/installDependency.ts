import * as vscode from 'vscode';
import { PACKAGE_NAME } from '../manifest';
import { TargetStore } from '../workloadPlacement/targetStore';
import { TargetTreeDependencyItem } from '../workloadPlacement/targetTreeDependencyItem';
import { showAndLogError } from '../util/showAndLogError';
import { ContainersManager } from '../workloadPlacement/containersManager';
import { HealthCheckDependency } from '../topoCliSchema';
import { logger } from '../util/logger';
import { executeTask } from '../util/executeTask';

const getInstallCommand = (sshTarget: string, value: string): string[] => {
    return ['topo', 'install', value, '--target', sshTarget];
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

        const target = this.targetStore.getSelectedTarget();
        if (!target) {
            return;
        }
        const { health } = await this.containersManager.getTargetState(target);

        const installables = new Set<string>();
        for (const dependency of health?.dependencies ?? []) {
            const installable = getInstallableDependency(dependency);
            if (installable) {
                installables.add(installable);
            }
        }

        if (installables.size > 0 && !abortController.signal.aborted) {
            await this.showInstallableNotification(target, [...installables]);
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

        const target = this.targetStore.getSelectedTarget();
        if (!target) {
            showAndLogError(
                `Failed to install dependency`,
                new Error('No selected target found'),
            );
            return;
        }

        const installable = getInstallableDependency(treeNode.dependency);
        if (!installable) {
            showAndLogError(
                `Failed to install dependency`,
                new Error(
                    'No installable dependency found for the selected item',
                ),
            );
            return;
        }

        await this.installDependency(target, installable);
    }

    private async installDependency(
        target: string,
        installable: string,
    ): Promise<void> {
        try {
            await executeTask(
                `Install ${installable} on ${target}`,
                getInstallCommand(target, installable),
            );
            vscode.window.showInformationMessage(
                `${installable} was installed on target ${target}`,
            );
        } catch (err) {
            showAndLogError(
                `Failed to install ${installable} on target ${target}`,
                err,
            );
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
