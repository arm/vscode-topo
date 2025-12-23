import * as manifest from './manifest';
import * as vscode from 'vscode';
import { CloneRemoteSource, TopoCli } from './topoCli';
import * as path from 'path';
import { getErrorMessage } from './util/getErrorMessage';

export type ProjectClonerBinary = Pick<TopoCli, 'getCloneCommand'>;

export class ProjectClone {

    public static remoteCloneCommand = `${manifest.PACKAGE_NAME}.remoteClone`;
    constructor(
        private readonly context: Pick<vscode.ExtensionContext, 'subscriptions'>,
        private readonly topoCli: ProjectClonerBinary
    ) {}

    public async activate() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(ProjectClone.remoteCloneCommand, this.cloneRemoteProject.bind(this))
        );
    }

    private async cloneRemoteProject(): Promise<void> {
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspacePath) {
            const errorMsg = 'No workspace folder is open. Please open a folder to clone the project into.';
            vscode.window.showErrorMessage(errorMsg);
            return;
        }
        const cloneSourceRemoteUrl = await vscode.window.showInputBox({ prompt: 'Enter the git URL to clone from' });
        if (!cloneSourceRemoteUrl) {
            return;
        }
        let defaultProjectName: string;
        try {
            defaultProjectName = this.getDefaultProjectNameFromUrl(cloneSourceRemoteUrl);
        } catch {
            const errorMsg = `${cloneSourceRemoteUrl} is not a valid URL. Please provide a valid git URL.`;
            vscode.window.showErrorMessage(errorMsg);
            return;
        }
        const projectName = await vscode.window.showInputBox({ prompt: 'Enter the project name', value: defaultProjectName });
        if (!projectName) {
            return;
        }
        const cloneCommand = this.getCloneCommand(workspacePath, projectName, cloneSourceRemoteUrl);
        const taskName = `Clone ${projectName}`;
        try {
            await this.executeCloneTask(cloneCommand, workspacePath, taskName);
        } catch (taskError: unknown) {
            const taskErrorMsg = getErrorMessage(taskError);
            const errorMsg = `Failed to start clone task "${taskName}": ${taskErrorMsg}`;
            vscode.window.showErrorMessage(errorMsg);
        }
    }

    private getDefaultProjectNameFromUrl(url: string): string {
        let pathname: string;
        // Support scp-like SSH URLs (e.g. git@host:owner/repo.git)
        const scpMatch = url.match(/^(?:[^@]+@)?[^:]+:(.+)$/);
        if (scpMatch) {
            pathname = scpMatch[1];
        } else {
            pathname = new URL(url).pathname;
        }
        const defaultProjectName = pathname.split('/').filter(Boolean).pop()?.replace(/\.git$/, '');
        if (!defaultProjectName) {
            throw new Error(`Invalid URL ${url}`);
        }
        return defaultProjectName;
    }

    private getCloneCommand(workspacePath: string, projectName: string, cloneSourceUrl: string): string[] {
        const projectPath = path.join(workspacePath, projectName);
        const cloneSource: CloneRemoteSource = {
            url: cloneSourceUrl,
            type: 'git',
        };
        const cloneCommand = this.topoCli.getCloneCommand(projectPath, cloneSource);
        return cloneCommand;
    }

    private async executeCloneTask(cloneCommand: string[], workspacePath: string, taskName: string) {
        const cmd = cloneCommand[0];
        const cmdArgs = cloneCommand.slice(1);
        const shellExecution = new vscode.ShellExecution(cmd, cmdArgs, { cwd: workspacePath });
        const workspace = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(workspacePath));
        const taskScope = workspace ?? vscode.TaskScope.Workspace;
        const taskDefinition: vscode.TaskDefinition = {
            type: 'shell',
            taskId: `${manifest.PACKAGE_NAME}.remoteClone`,
        };
        const task = new vscode.Task(taskDefinition, taskScope, taskName, manifest.DISPLAY_NAME, shellExecution);
        task.presentationOptions = {
            reveal: vscode.TaskRevealKind.Always,
            echo: true,
            focus: true,
            showReuseMessage: true,
            clear: true,
        };
        const taskExecution = await vscode.tasks.executeTask(task);
        const taskEndDisposable = vscode.tasks.onDidEndTaskProcess((e) => {
            if (e.execution === taskExecution) {
                taskEndDisposable.dispose();
                if (typeof e.exitCode === 'number' && e.exitCode !== 0) {
                    vscode.window.showErrorMessage(`Clone task "${taskName}" failed with exit code ${e.exitCode}.`);
                }
            }
        });
        this.context.subscriptions.push(taskEndDisposable);
    }
}
