import * as vscode from 'vscode';
import { PACKAGE_NAME } from '../manifest';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import { HealthCheckDependencyTreeItem } from '../treeItems/healthCheckDependencyTreeItem';
import { showAndLogError } from '../util/showAndLogError';
import { logger } from '../util/logger';
import { executeTask } from '../util/executeTask';
import { getFixCommandArgs } from '../util/getFixCommandArgs';
import {
    getFixableDependencyFixes,
    IssueFix,
} from '../util/getDependencyFixes';
import { ContainersManager } from '../target/containersManager';
import { HealthCheckDependency, HealthCheckFix } from '../topoCliSchema';
import { TargetDescriptionStore } from '../target/targetDescriptionStore';
import { getTargetDependencies } from '../target/getTargetDependencies';
import { TargetModel } from '../models/targetModel';
import { DisposableCollector } from '../util/disposableCollector';

type IssueFixQuickPickItem = vscode.QuickPickItem & IssueFix;

export class FixIssue implements vscode.Disposable {
    private readonly disposables = new DisposableCollector();
    public static readonly fixDependencyIssueCommand = `${PACKAGE_NAME}.fixDependencyIssue`;
    public static readonly fixTargetIssuesCommand = `${PACKAGE_NAME}.fixTargetIssues`;

    constructor(
        private readonly targetModel: TargetModel,
        private readonly containersManager: ContainersManager,
        private readonly targetDescriptionStore: TargetDescriptionStore,
    ) {
        this.disposables.collect(
            vscode.commands.registerCommand(
                FixIssue.fixDependencyIssueCommand,
                this.fixDependencyIssueFromTreeItem.bind(this),
            ),
            vscode.commands.registerCommand(
                FixIssue.fixTargetIssuesCommand,
                this.fixTargetIssuesFromTreeItem.bind(this),
            ),
        );
    }

    private async fixDependencyIssueFromTreeItem(
        treeNode: unknown,
    ): Promise<void> {
        if (!(treeNode instanceof HealthCheckDependencyTreeItem)) {
            const errMsg = `Invalid dependency item for fix issue: expected HealthCheckDependencyTreeItem but received:`;
            logger.error(errMsg, treeNode);
            return;
        }

        const target = this.targetModel.selected;
        if (!target) {
            showAndLogError(
                `Failed to fix issue`,
                new Error('No selected target found'),
            );
            return;
        }

        const fix = treeNode.dependency.fix;
        if (!fix?.command) {
            showAndLogError(
                `Failed to fix issue`,
                new Error('No executable fix found for the selected item'),
            );
            return;
        }

        await this.executeFix(target, [treeNode.dependency.name], fix);
    }

    private async fixTargetIssuesFromTreeItem(
        treeNode: unknown,
    ): Promise<void> {
        if (!(treeNode instanceof TargetTreeItem)) {
            const errMsg = `Invalid target item for fix an issue: expected TargetTreeItem but received:`;
            logger.error(errMsg, treeNode);
            return;
        }

        const dependencies = await getTargetDependencies(
            treeNode.target,
            this.containersManager,
            this.targetDescriptionStore,
        );
        const fixes = this.getFixableDependencyItems(dependencies);

        if (fixes.length === 0) {
            showAndLogError(
                `Failed to fix issue`,
                new Error(
                    `No executable dependency fixes found for target ${treeNode.target}`,
                ),
            );
            return;
        }

        await this.selectAndFixTargetIssue(treeNode.target, fixes);
    }

    private getFixableDependencyItems(
        dependencies: HealthCheckDependency[],
    ): IssueFixQuickPickItem[] {
        return getFixableDependencyFixes(dependencies).map(
            ({ dependency, fix }) => ({
                label: dependency.name,
                description: fix.description,
                detail: `Command: ${fix.command}`,
                dependency,
                fix,
            }),
        );
    }

    private async selectAndFixTargetIssue(
        target: string,
        fixes: IssueFixQuickPickItem[],
    ): Promise<void> {
        const selectedFix = await vscode.window.showQuickPick(fixes, {
            placeHolder: `Select a dependency fix for ${target}`,
        });
        if (!selectedFix) {
            return;
        }

        await this.executeFix(
            target,
            [selectedFix.dependency.name],
            selectedFix.fix,
        );
    }

    private async executeFix(
        target: string,
        names: string[],
        fix: HealthCheckFix,
    ): Promise<void> {
        const name = names.join(', ');
        const commandArgs = getFixCommandArgs(fix.command);
        if (!commandArgs) {
            showAndLogError(
                `Failed to fix ${name} on target ${target}`,
                new Error('No executable command found'),
            );
            return;
        }

        try {
            await executeTask(`Fix ${name} on ${target}`, commandArgs);
        } catch (err) {
            showAndLogError(`Failed to fix ${name} on target ${target}`, err);
        }
    }

    public dispose(): void {
        this.disposables.dispose();
    }
}
