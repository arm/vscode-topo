import * as manifest from './manifest';
import * as vscode from 'vscode';
import { CloneSource, TopoCli } from './topoCli';
import * as path from 'path';
import { getErrorMessage } from './util/getErrorMessage';

const getLocalSourcePath = async (): Promise<string | undefined> => {
    const cloneSourceUri = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select Project to Clone',
    });
    if (!cloneSourceUri || cloneSourceUri.length === 0) {
        return undefined;
    }
    return cloneSourceUri[0].fsPath;
};

const executeCloneTask = async (
    cloneCommand: string[],
    workspacePath: string,
    taskName: string,
): Promise<vscode.Disposable> => {
    const cmd = cloneCommand[0];
    const cmdArgs = cloneCommand.slice(1);
    const shellExecution = new vscode.ShellExecution(cmd, cmdArgs, {
        cwd: workspacePath,
    });
    const workspace = vscode.workspace.getWorkspaceFolder(
        vscode.Uri.file(workspacePath),
    );
    const taskScope = workspace ?? vscode.TaskScope.Workspace;
    const taskDefinition: vscode.TaskDefinition = {
        type: 'shell',
        taskId: `${manifest.PACKAGE_NAME} clone`,
    };
    const task = new vscode.Task(
        taskDefinition,
        taskScope,
        taskName,
        manifest.DISPLAY_NAME,
        shellExecution,
    );
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
                vscode.window.showErrorMessage(
                    `Clone task "${taskName}" failed with exit code ${e.exitCode}.`,
                );
            }
        }
    });
    return taskEndDisposable;
};

const getDefaultProjectNameFromUrl = (url: string): string => {
    let pathname: string;
    // Support scp-like SSH URLs (e.g. git@host:owner/repo.git)
    const scpMatch = url.match(/^(?:[^@]+@)?[^:]+:(.+)$/);
    if (scpMatch) {
        pathname = scpMatch[1];
    } else {
        pathname = new URL(url).pathname;
    }
    const defaultProjectName = pathname
        .split('/')
        .filter(Boolean)
        .pop()
        ?.replace(/\.git$/, '');
    if (!defaultProjectName) {
        throw new Error(`Invalid URL ${url}`);
    }
    return defaultProjectName;
};

export class ProjectClone {
    public static remoteCloneCommand = `${manifest.PACKAGE_NAME}.remoteClone`;
    public static localCloneCommand = `${manifest.PACKAGE_NAME}.localClone`;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly topoCli: TopoCli,
    ) {}

    public async activate() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                ProjectClone.remoteCloneCommand,
                this.cloneRemoteProject.bind(this),
            ),
            vscode.commands.registerCommand(
                ProjectClone.localCloneCommand,
                this.cloneLocalProject.bind(this),
            ),
        );
    }

    private async cloneLocalProject(): Promise<void> {
        const workspacePath =
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspacePath) {
            const errorMsg =
                'No workspace folder is open. Please open a folder to clone the project into.';
            vscode.window.showErrorMessage(errorMsg);
            return;
        }
        const cloneSourcePath = await getLocalSourcePath();
        if (!cloneSourcePath) {
            return;
        }
        const projectName = await vscode.window.showInputBox({
            prompt: 'Enter the project name',
            value: path.basename(cloneSourcePath),
        });
        if (!projectName) {
            return;
        }
        const cloneCommand = this.getCloneCommand(
            workspacePath,
            projectName,
            cloneSourcePath,
            'local',
        );
        const taskName = `Clone ${projectName}`;
        try {
            const cloneTask = await executeCloneTask(
                cloneCommand,
                workspacePath,
                taskName,
            );
            this.context.subscriptions.push(cloneTask);
        } catch (taskError: unknown) {
            const taskErrorMsg = getErrorMessage(taskError);
            const errorMsg = `Failed to start clone task "${taskName}": ${taskErrorMsg}`;
            vscode.window.showErrorMessage(errorMsg);
        }
    }

    private async cloneRemoteProject(): Promise<void> {
        const workspacePath =
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspacePath) {
            const errorMsg =
                'No workspace folder is open. Please open a folder to clone the project into.';
            vscode.window.showErrorMessage(errorMsg);
            return;
        }
        const cloneSourceRemoteUrl = await vscode.window.showInputBox({
            prompt: 'Enter the git URL to clone from',
        });
        if (!cloneSourceRemoteUrl) {
            return;
        }
        let defaultProjectName: string;
        try {
            defaultProjectName =
                getDefaultProjectNameFromUrl(cloneSourceRemoteUrl);
        } catch {
            const errorMsg = `${cloneSourceRemoteUrl} is not a valid URL. Please provide a valid git URL.`;
            vscode.window.showErrorMessage(errorMsg);
            return;
        }
        const projectName = await vscode.window.showInputBox({
            prompt: 'Enter the project name',
            value: defaultProjectName,
        });
        if (!projectName) {
            return;
        }
        const cloneCommand = this.getCloneCommand(
            workspacePath,
            projectName,
            cloneSourceRemoteUrl,
            'git',
        );
        const taskName = `Clone ${projectName}`;
        try {
            const cloneTask = await executeCloneTask(
                cloneCommand,
                workspacePath,
                taskName,
            );
            this.context.subscriptions.push(cloneTask);
        } catch (taskError: unknown) {
            const taskErrorMsg = getErrorMessage(taskError);
            const errorMsg = `Failed to start clone task "${taskName}": ${taskErrorMsg}`;
            vscode.window.showErrorMessage(errorMsg);
        }
    }

    private getCloneCommand(
        workspacePath: string,
        projectName: string,
        cloneSourceLocation: string,
        type: CloneSource['type'],
    ): string[] {
        const projectPath = path.join(workspacePath, projectName);
        let cloneSource: CloneSource;
        switch (type) {
            case 'git':
                cloneSource = {
                    url: cloneSourceLocation,
                    type: 'git',
                };
                break;
            case 'local':
                cloneSource = {
                    path: cloneSourceLocation,
                    type: 'local',
                };
                break;
        }
        const cloneCommand = this.topoCli.getCloneCommand(
            projectPath,
            cloneSource,
        );
        return cloneCommand;
    }
}
