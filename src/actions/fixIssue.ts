import * as vscode from 'vscode';
import { refreshSelectedTargetHealth } from '../commandIds';
import { HealthCheckGroupTreeItem } from '../views/treeItems/healthCheckGroupTreeItem';
import { HealthCheckTreeItem } from '../views/treeItems/healthCheckTreeItem';
import { showAndLogError } from '../util/showAndLog';
import { runTask } from '../util/task';
import { TargetModel } from '../models/targetModel';
import {
    hasFixCommand,
    type FixableIssue,
    getIssueFixCommandGroups,
} from '../util/issueFixes';
import type { TaskFactory } from '../tasks/taskFactory';

type IssueFixQuickPickItem = vscode.QuickPickItem & {
    issue: FixableIssue;
};

function getIssueFixQuickPickItems(
    issues: readonly FixableIssue[],
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
        private readonly taskFactory: TaskFactory,
        private readonly targetModel: TargetModel,
    ) {}

    public async fixIssueCommandHandler(treeNode: unknown): Promise<void> {
        if (treeNode instanceof HealthCheckGroupTreeItem) {
            await this.fixHealthGroupChecksFromTreeItem(treeNode);
        } else if (treeNode instanceof HealthCheckTreeItem) {
            await this.fixIssueFromTreeItem(treeNode);
        } else {
            throw new Error(
                `Invalid item for fix issues: expected HealthCheckGroupTreeItem or HealthCheckTreeItem but received: ${String(treeNode)}`,
            );
        }

        await vscode.commands.executeCommand(refreshSelectedTargetHealth);
    }

    private async fixIssueFromTreeItem(
        treeNode: HealthCheckTreeItem,
    ): Promise<void> {
        const target = this.targetModel.selected;
        if (!target) {
            throw new Error('No selected target found');
        }

        const command = treeNode.healthCheck.data.fix?.command;
        if (!command) {
            throw new Error('No executable fix found for the selected item');
        }

        await this.executeFix(
            target,
            [treeNode.healthCheck.data.name],
            command,
        );
    }

    private async fixHealthGroupChecksFromTreeItem(
        healthGroupItem: HealthCheckGroupTreeItem,
    ): Promise<void> {
        const target = this.targetModel.selected;
        if (!target) {
            throw new Error('No selected target found');
        }

        const fixableIssues =
            healthGroupItem.healthChecks.filter(hasFixCommand);
        if (fixableIssues.length === 0) {
            throw new Error(
                `No executable issue fixes found for target ${target}`,
            );
        }

        await this.selectAndFixTargetIssues(target, fixableIssues);
    }

    private async selectAndFixTargetIssues(
        target: string,
        issues: readonly FixableIssue[],
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
        issueNames: readonly string[],
        command: string,
    ): Promise<void> {
        const issueName = issueNames.join(', ');
        const task = createFixIssueTask(
            this.taskFactory,
            target,
            issueNames,
            command,
        );

        try {
            await runTask(task);
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
    taskFactory: TaskFactory,
    target: string,
    issueNames: readonly string[],
    command: string,
): vscode.Task {
    const issueName = issueNames.join(', ');
    const commandArgs = command.trim().split(/\s+/);
    return taskFactory.createShellTask(
        `Fix ${issueName} on ${target}`,
        commandArgs,
    );
}
