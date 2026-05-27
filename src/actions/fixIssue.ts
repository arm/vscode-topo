import * as vscode from 'vscode';
import { PACKAGE_NAME } from '../manifest';
import { TargetStore } from '../target/targetStore';
import { HealthCheckDependencyTreeItem } from '../treeItems/healthCheckDependencyTreeItem';
import { showAndLogError } from '../util/showAndLogError';
import { ContainersManager } from '../target/containersManager';
import { logger } from '../util/logger';
import { executeTask } from '../util/executeTask';
import { getFixCommandArgs } from '../util/getFixCommandArgs';
import {
    type DependencyFixCommandGroup,
    getDependencyFixCommandGroups,
} from '../util/getDependencyFixes';

const fixAction = { title: 'Fix' };

export class FixIssue implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];
    private targetChangedAbortController: AbortController | undefined;
    public static readonly fixIssueCommand = `${PACKAGE_NAME}.fixIssue`;

    constructor(
        private readonly targetStore: TargetStore,
        private readonly containersManager: ContainersManager,
    ) {}

    public async activate(): Promise<void> {
        this.disposables.push(
            vscode.commands.registerCommand(
                FixIssue.fixIssueCommand,
                this.fixIssueFromTreeItem.bind(this),
            ),
            this.targetStore.onChanged(this.promptToFixIssues.bind(this)),
        );

        await this.promptToFixIssues();
    }

    private async promptToFixIssues(): Promise<void> {
        this.targetChangedAbortController?.abort();
        const abortController = new AbortController();
        this.targetChangedAbortController = abortController;

        const target = this.targetStore.getSelectedTarget();
        if (!target) {
            return;
        }
        const { health } = await this.containersManager.getTargetState(target);

        const fixableDependencies = health?.dependencies
            ? getDependencyFixCommandGroups(health.dependencies)
            : [];

        if (fixableDependencies.length > 0 && !abortController.signal.aborted) {
            await this.showFixableDependenciesPrompt(
                target,
                fixableDependencies,
            );
        }
    }

    private async fixIssueFromTreeItem(treeNode: unknown): Promise<void> {
        if (!(treeNode instanceof HealthCheckDependencyTreeItem)) {
            const errMsg = `Invalid dependency item for fix issue: expected HealthCheckDependencyTreeItem but received:`;
            logger.error(errMsg, treeNode);
            return;
        }

        const target = this.targetStore.getSelectedTarget();
        if (!target) {
            showAndLogError(
                `Failed to fix dependency`,
                new Error('No selected target found'),
            );
            return;
        }

        const command = treeNode.dependency.fix?.command;
        if (!command) {
            showAndLogError(
                `Failed to fix dependency`,
                new Error('No fixable dependency found for the selected item'),
            );
            return;
        }

        await this.executeFixCommand(
            target,
            [treeNode.dependency.name],
            command,
        );
    }

    private async executeFixCommand(
        target: string,
        names: string[],
        command: string,
    ): Promise<void> {
        const name = names.join(', ');
        const commandArgs = getFixCommandArgs(command);
        if (!commandArgs) {
            showAndLogError(
                `Failed to fix ${name} on target ${target}`,
                new Error('No executable command found'),
            );
            return;
        }

        try {
            await executeTask(`Fix ${name} on ${target}`, commandArgs);
            vscode.window.showInformationMessage(
                `${name} was fixed on target ${target}`,
            );
        } catch (err) {
            showAndLogError(`Failed to fix ${name} on target ${target}`, err);
        }
    }

    private async showFixableDependenciesPrompt(
        target: string,
        fixableDependencies: DependencyFixCommandGroup[],
    ): Promise<void> {
        const choice = await vscode.window.showWarningMessage(
            `${target} has missing or unhealthy dependencies: ${fixableDependencies.flatMap(({ names }) => names).join(`, `)}`,
            fixAction,
        );
        if (choice?.title === fixAction.title) {
            for (const fixableDependency of fixableDependencies) {
                await this.executeFixCommand(
                    target,
                    fixableDependency.names,
                    fixableDependency.command,
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
