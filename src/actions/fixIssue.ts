import * as vscode from 'vscode';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import { HealthCheckDependencyTreeItem } from '../treeItems/healthCheckDependencyTreeItem';
import { showAndLogError } from '../util/showAndLogError';
import { createProcessTask } from '../util/task';
import { TaskExecutor } from '../util/taskExecutor';
import { TargetModel } from '../models/targetModel';
import {
    type FixableHealthIssue,
    getIssueFixCommandGroups,
} from '../util/issueFixes';

type IssueFixQuickPickItem = vscode.QuickPickItem & {
    issue: FixableHealthIssue;
};

function getIssueFixQuickPickItems(
    issues: FixableHealthIssue[],
): IssueFixQuickPickItem[] {
    return issues.map((issue) => ({
        label: issue.name,
        description: issue.fix.description,
        detail: `Command: ${issue.fix.command}`,
        issue,
    }));
}

export class FixIssue {
    constructor(
        private readonly taskExecutor: TaskExecutor,
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

        throw new Error(
            `Invalid item for fix issues: expected HealthCheckDependencyTreeItem or TargetTreeItem but received: ${String(treeNode)}`,
        );
    }

    private async fixDependencyIssueFromTreeItem(
        treeNode: HealthCheckDependencyTreeItem,
    ): Promise<void> {
        const target = this.targetModel.selected;
        if (!target) {
            throw new Error('No selected target found');
        }

        const command = treeNode.dependency.fix?.command;
        if (!command) {
            throw new Error('No executable fix found for the selected item');
        }

        await this.executeFix(target, [treeNode.dependency.name], command);
    }

    private async fixTargetIssuesFromTreeItem(
        treeNode: TargetTreeItem,
    ): Promise<void> {
        const fixableIssues = treeNode.fixableIssues;

        if (fixableIssues.length === 0) {
            throw new Error(
                `No executable issue fixes found for target ${treeNode.target}`,
            );
        }

        await this.selectAndFixTargetIssue(treeNode.target, fixableIssues);
    }

    private async selectAndFixTargetIssue(
        target: string,
        issues: FixableHealthIssue[],
    ): Promise<void> {
        const selectedFixes = await vscode.window.showQuickPick(
            getIssueFixQuickPickItems(issues),
            {
                canPickMany: true,
                placeHolder: `Select fixes for ${target}`,
            },
        );

        if (!selectedFixes || selectedFixes.length === 0) {
            return;
        }

        const selectedIssues = selectedFixes.map(
            (selectedFix) => selectedFix.issue,
        );

        const fixGroups = getIssueFixCommandGroups(selectedIssues);
        for (const fixGroup of fixGroups) {
            await this.executeFix(
                target,
                fixGroup.issueNames,
                fixGroup.command,
            );
        }
    }

    private async executeFix(
        target: string,
        issueNames: string[],
        command: string,
    ): Promise<void> {
        const issueName = issueNames.join(', ');
        const task = createFixIssueTask(target, issueNames, command);

        try {
            await this.taskExecutor.run(task);
            vscode.window.showInformationMessage(
                `${issueName} fixed on target ${target}`,
            );
        } catch (err) {
            showAndLogError(
                `Failed to fix ${issueName} on target ${target}`,
                err,
            );
        }
    }
}

export function createFixIssueTask(
    target: string,
    issueNames: string[],
    command: string,
): vscode.Task {
    const issueName = issueNames.join(', ');
    const commandArgs = command.trim().split(/\s+/);
    return createProcessTask(`Fix ${issueName} on ${target}`, commandArgs);
}
