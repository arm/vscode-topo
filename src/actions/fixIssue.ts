import * as vscode from 'vscode';
import { HealthCheckGroupTreeItem } from '../views/treeItems/healthCheckGroupTreeItem';
import { HealthCheckTreeItem } from '../views/treeItems/healthCheckTreeItem';
import { showAndLogError } from '../util/showAndLog';
import { createProcessTask } from '../util/task';
import { TaskExecutor } from '../util/taskExecutor';
import { TargetModel } from '../models/targetModel';
import { TargetController } from '../controllers/targetController';
import {
    hasFixCommand,
    type FixableIssue,
    getIssueFixCommandGroups,
} from '../util/issueFixes';

type IssueFixQuickPickItem = vscode.QuickPickItem & {
    issue: FixableIssue;
};

function getIssueFixQuickPickItems(
    issues: FixableIssue[],
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
        private readonly targetController: TargetController,
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

        await this.targetController.refreshSelectedTargetHealthCommandHandler();
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
        issues: FixableIssue[],
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
