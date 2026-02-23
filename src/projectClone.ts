import * as manifest from './manifest';
import * as vscode from 'vscode';
import { TopoCli } from './topoCli';
import * as path from 'path';
import { getErrorMessage } from './util/getErrorMessage';
import { TemplateDescription } from './util/types';

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

const getFirstSentence = (text?: string): string | undefined => {
    if (!text) {
        return undefined;
    }
    const trimmed = text.trim();
    if (!trimmed) {
        return undefined;
    }
    const match = trimmed.match(/^.*?[.!?](?=\s|$)/);
    return (match ? match[0] : trimmed).trim();
};

const getCloneCommandFromSourceString = (
    workspacePath: string,
    projectName: string,
    cloneSourceString: string,
): string[] => {
    const projectPath = path.join(workspacePath, projectName);
    return ['topo', 'clone', projectPath, cloneSourceString];
};

export class ProjectClone {
    public static remoteCloneCommand = `${manifest.PACKAGE_NAME}.remoteClone`;
    public static localCloneCommand = `${manifest.PACKAGE_NAME}.localClone`;
    public static templateCloneCommand = `${manifest.PACKAGE_NAME}.templateClone`;

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
            vscode.commands.registerCommand(
                ProjectClone.templateCloneCommand,
                this.cloneTemplateProject.bind(this),
            ),
        );
    }

    private async cloneTemplateProject(): Promise<void> {
        const workspacePath = this.getWorkspacePath();
        if (!workspacePath) {
            return;
        }
        const selectedTemplate = await this.getTemplateOfChoice();
        if (!selectedTemplate) {
            return;
        }
        const cloneSourceString = `template:${selectedTemplate.id}`;
        await this.cloneWithSource(
            workspacePath,
            cloneSourceString,
            selectedTemplate.id,
        );
    }

    private async cloneLocalProject(): Promise<void> {
        const workspacePath = this.getWorkspacePath();
        if (!workspacePath) {
            return;
        }
        const cloneSourcePath = await getLocalSourcePath();
        if (!cloneSourcePath) {
            return;
        }
        const cloneSourceString = `dir:${cloneSourcePath}`;
        await this.cloneWithSource(
            workspacePath,
            cloneSourceString,
            path.basename(cloneSourcePath),
        );
    }

    private async cloneRemoteProject(): Promise<void> {
        const workspacePath = this.getWorkspacePath();
        if (!workspacePath) {
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
        const cloneSourceString = `git:${cloneSourceRemoteUrl}`;
        await this.cloneWithSource(
            workspacePath,
            cloneSourceString,
            defaultProjectName,
        );
    }

    private getWorkspacePath(): string | undefined {
        const workspacePath =
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspacePath) {
            const errorMsg =
                'No workspace folder is open. Please open a folder to clone the project into.';
            vscode.window.showErrorMessage(errorMsg);
            return undefined;
        }
        return workspacePath;
    }

    private async cloneWithSource(
        workspacePath: string,
        cloneSourceString: string,
        defaultProjectName: string,
    ): Promise<void> {
        const projectName = await vscode.window.showInputBox({
            prompt: 'Enter the project name',
            value: defaultProjectName,
        });
        if (!projectName) {
            return;
        }
        const cloneCommand = getCloneCommandFromSourceString(
            workspacePath,
            projectName,
            cloneSourceString,
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

    private getTemplateOfChoice = async (): Promise<
        TemplateDescription | undefined
    > => {
        const templates = this.topoCli.listTemplates();
        const templateItems = templates.map((template) => ({
            label: template.id,
            detail: getFirstSentence(template.description),
            template,
        }));

        const selectedTemplateItem = await vscode.window.showQuickPick(
            templateItems,
            {
                placeHolder: 'Select a template to clone',
            },
        );
        if (!selectedTemplateItem) {
            return undefined;
        }

        return selectedTemplateItem.template;
    };
}
