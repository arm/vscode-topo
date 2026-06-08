import * as vscode from 'vscode';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import { HealthCheckDependencyTreeItem } from '../treeItems/healthCheckDependencyTreeItem';
import { showAndLogError } from '../util/showAndLogError';
import { executeTask } from '../util/executeTask';
import { TargetModel } from '../models/targetModel';
import { TopoCli } from '../topoCli';
import { type FixableHealthIssue } from '../util/getIssueFixes';

type IssueFixQuickPickItem = vscode.QuickPickItem & FixableHealthIssue;

function getIssueFixQuickPickItems(
    issues: FixableHealthIssue[],
): IssueFixQuickPickItem[] {
    return issues.map((issue) => ({
        label: issue.name,
        description: issue.fix.description,
        detail: `Command: ${issue.fix.command}`,
        ...issue,
    }));
}

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

        throw new Error(
            `Invalid item for fix issue: expected HealthCheckDependencyTreeItem or TargetTreeItem but received: ${String(treeNode)}`,
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
        if (!treeNode.selected) {
            throw new Error(
                `Invalid target item for fix an issue: expected selected TargetTreeItem but received: ${String(treeNode)}`,
            );
        }

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
        const selectedFix = await vscode.window.showQuickPick(
            getIssueFixQuickPickItems(issues),
            {
                placeHolder: `Select an issue fix for ${target}`,
            },
        );
        if (!selectedFix) {
            return;
        }

        await this.executeFix(
            target,
            [selectedFix.name],
            selectedFix.fix.command,
        );
    }

    private async executeFix(
        target: string,
        issueNames: string[],
        command: string,
    ): Promise<void> {
        const issueName = issueNames.join(', ');
        const commandArgs = command.split(/\s+/);
        if (commandArgs[0] === 'topo') {
            commandArgs[0] = this.topoCli.getBinaryPath();
        }

        try {
            await executeTask(`Fix ${issueName} on ${target}`, commandArgs);
            vscode.window.showInformationMessage(
                `${issueName} was fixed on target ${target}`,
            );
        } catch (err) {
            showAndLogError(
                `Failed to fix ${issueName} on target ${target}`,
                err,
            );
        }
    }
}
