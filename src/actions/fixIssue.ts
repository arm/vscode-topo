import * as vscode from 'vscode';
import { PACKAGE_NAME } from '../manifest';
import { HealthCheckDependencyTreeItem } from '../treeItems/healthCheckDependencyTreeItem';
import { showAndLogError } from '../util/showAndLogError';
import { logger } from '../util/logger';
import { executeTask } from '../util/executeTask';
import { getFixCommandArgs } from '../util/getFixCommandArgs';
import { TargetModel } from '../models/targetModel';
import { DisposableCollector } from '../util/disposableCollector';
import { TopoCli } from '../topoCli';

export class FixIssue implements vscode.Disposable {
    private readonly disposables = new DisposableCollector();
    public static readonly fixIssueCommand = `${PACKAGE_NAME}.fixIssue`;

    constructor(
        private readonly topoCli: TopoCli,
        private readonly targetModel: TargetModel,
    ) {
        this.disposables.collect(
            vscode.commands.registerCommand(
                FixIssue.fixIssueCommand,
                this.fixIssueFromTreeItem.bind(this),
            ),
        );
    }

    private async fixIssueFromTreeItem(treeNode: unknown): Promise<void> {
        if (!(treeNode instanceof HealthCheckDependencyTreeItem)) {
            const errMsg = `Invalid dependency item for fix issue: expected HealthCheckDependencyTreeItem but received:`;
            logger.error(errMsg, treeNode);
            return;
        }

        const target = this.targetModel.selected;
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
        if (commandArgs[0] === 'topo') {
            commandArgs[0] = this.topoCli.getBinaryPath();
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

    public dispose(): void {
        this.disposables.dispose();
    }
}
