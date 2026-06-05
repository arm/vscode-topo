import * as vscode from 'vscode';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import { HealthCheckDependencyTreeItem } from '../treeItems/healthCheckDependencyTreeItem';
import { showAndLogError } from '../util/showAndLogError';
import { executeTask } from '../util/executeTask';
import {
    getFixableDependencyFixes,
    IssueFix,
} from '../util/getDependencyFixes';
import { HealthCheckDependency } from '../topoCliSchema';
import { TargetModel } from '../models/targetModel';
import { TopoCli } from '../topoCli';

type IssueFixQuickPickItem = vscode.QuickPickItem & IssueFix;

function getFixableDependencyQuickPickItems(
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

        const fix = treeNode.dependency.fix;
        if (!fix?.command) {
            throw new Error('No executable fix found for the selected item');
        }

        await this.executeFix(target, [treeNode.dependency.name], fix.command);
    }

    private async fixTargetIssuesFromTreeItem(
        treeNode: TargetTreeItem,
    ): Promise<void> {
        if (!treeNode.selected) {
            throw new Error(
                `Invalid target item for fix an issue: expected selected TargetTreeItem but received: ${String(treeNode)}`,
            );
        }

        const fixes = getFixableDependencyQuickPickItems(
            treeNode.visibleDependencies,
        );

        if (fixes.length === 0) {
            throw new Error(
                `No executable dependency fixes found for target ${treeNode.target}`,
            );
        }

        await this.selectAndFixTargetIssue(treeNode.target, fixes);
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

        if (!selectedFix.fix.command) {
            throw new Error('No executable fix found for the selected item');
        }

        await this.executeFix(
            target,
            [selectedFix.dependency.name],
            selectedFix.fix.command,
        );
    }

    private async executeFix(
        target: string,
        dependencyNames: string[],
        command: string,
    ): Promise<void> {
        const dependencyName = dependencyNames.join(', ');
        const commandArgs = command.split(/\s+/);
        if (commandArgs[0] === 'topo') {
            commandArgs[0] = this.topoCli.getBinaryPath();
        }

        try {
            await executeTask(`Fix ${dependencyName} on ${target}`, commandArgs);
            vscode.window.showInformationMessage(
                `${dependencyName} was fixed on target ${target}`,
            );
        } catch (err) {
            showAndLogError(
                `Failed to fix ${dependencyName} on target ${target}`,
                err,
            );
        }
    }
}
