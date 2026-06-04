import * as vscode from 'vscode';
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
import { HealthCheckDependency, HealthCheckFix } from '../topoCliSchema';
import { TargetModel } from '../models/targetModel';
import { TopoCli } from '../topoCli';

type IssueFixQuickPickItem = vscode.QuickPickItem & IssueFix;

export class FixIssue {
    constructor(
        private readonly topoCli: TopoCli,
        private readonly targetModel: TargetModel,
    ) {}

    public async fixIssueCommandHandler(treeNode: unknown): Promise<void> {
        if (treeNode instanceof HealthCheckDependencyTreeItem) {
            await this.fixDependencyIssueFromTreeItem(treeNode);
            return;
        }

        if (treeNode instanceof TargetTreeItem) {
            await this.fixTargetIssuesFromTreeItem(treeNode);
            return;
        }

        const errMsg = `Invalid item for fix issue: expected HealthCheckDependencyTreeItem or TargetTreeItem but received:`;
        logger.error(errMsg, treeNode);
    }

    private async fixDependencyIssueFromTreeItem(
        treeNode: HealthCheckDependencyTreeItem,
    ): Promise<void> {
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
        treeNode: TargetTreeItem,
    ): Promise<void> {
        if (!treeNode.selected) {
            const errMsg = `Invalid target item for fix an issue: expected selected TargetTreeItem but received:`;
            logger.error(errMsg, treeNode);
            return;
        }

        const fixes = this.getFixableDependencyItems(
            treeNode.visibleDependencies,
        );

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
}
