import * as manifest from './manifest';
import * as vscode from 'vscode';
import { CloneSource, TopoCli } from './topoCli';
import * as path from 'path';
import { TemplateDescription } from './topoCliSchema';
import { getWorkspacePath } from './util/getWorkspacePath';
import { isTopoError, TopoError } from './errors/topoError';
import { showAndLogError } from './util/showAndLogError';

type CloneResult =
    | {
          success: true;
          repositoryPath: string;
      }
    | {
          success: false;
      };
type CloneBuildArgs = Record<string, string>;

const postCloneAction = async (repositoryPath: string) => {
    let message = 'Would you like to open the cloned repository?';
    const open = 'Open';
    const openNewWindow = 'Open in New Window';
    const choices = [open, openNewWindow];

    const addToWorkspace = 'Add to Workspace';
    if (vscode.workspace.workspaceFolders) {
        message =
            'Would you like to open the cloned repository, or add it to the current workspace?';
        choices.push(addToWorkspace);
    }

    const selection = await vscode.window.showInformationMessage(
        message,
        { modal: true },
        ...choices,
    );
    const uri = vscode.Uri.file(repositoryPath);

    switch (selection) {
        case open:
            vscode.commands.executeCommand('vscode.openFolder', uri, {
                forceReuseWindow: true,
            });
            return;
        case addToWorkspace:
            vscode.workspace.updateWorkspaceFolders(
                vscode.workspace.workspaceFolders!.length,
                0,
                { uri },
            );
            return;
        case openNewWindow:
            vscode.commands.executeCommand('vscode.openFolder', uri, {
                forceNewWindow: true,
            });
            return;
        case undefined:
        default:
            return;
    }
};

export const getFirstSentence = (text: string): string => {
    const trimmed = text.trim();
    const match = trimmed.match(/^.*?[.!?](?=\s|$)/);
    return (match ? match[0] : trimmed).trim();
};

const assertWorkspacePath = (): string => {
    const workspacePath = getWorkspacePath();
    if (!workspacePath) {
        throw new TopoError(
            'CLONE',
            'No workspace folder is open. Please open a folder to clone the project into.',
        );
    }
    return workspacePath;
};

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
): Promise<boolean> => {
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
    return await new Promise<boolean>((resolve, reject) => {
        const taskEndDisposable = vscode.tasks.onDidEndTaskProcess((e) => {
            if (e.execution !== taskExecution) {
                return;
            }
            taskEndDisposable.dispose();
            if (e.exitCode === 0) {
                resolve(true);
            } else {
                const errorMsg = `Clone task "${taskName}" failed with exit code ${e.exitCode}.`;
                reject(new TopoError('CLONE', errorMsg));
            }
        });
    });
};

const getDefaultProjectNameFromUrl = (url: string): string => {
    let pathname: string;
    // Support scp-like SSH URLs (e.g. git@host:owner/repo.git)
    const scpMatch = url.match(/^(?:[^@]+@)?[^:]+:(.+)$/);
    if (scpMatch) {
        pathname = scpMatch[1];
    } else {
        try {
            pathname = new URL(url).pathname;
        } catch {
            throw new TopoError('CLONE', `Invalid URL: ${url}`);
        }
    }
    const defaultProjectName = pathname
        .split('/')
        .filter(Boolean)
        .pop()
        ?.replace(/\.git$/, '');
    if (!defaultProjectName) {
        throw new TopoError('CLONE', `Invalid URL: ${url}`);
    }
    return defaultProjectName;
};

const getDefaultProjectNameFromSourceString = (
    cloneSource: CloneSource,
): string => {
    switch (cloneSource.type) {
        case 'dir':
            return path.basename(cloneSource.path);
        case 'template':
            return cloneSource.template;
        case 'git':
            return getDefaultProjectNameFromUrl(cloneSource.url);
        case undefined:
            return getDefaultProjectNameFromUrl(cloneSource.value);
    }
};

const getCloneCommandFromSourceString = (
    workspacePath: string,
    projectName: string,
    cloneSourceString: string,
    cloneBuildArgs: CloneBuildArgs = {},
): string[] => {
    const projectPath = path.join(workspacePath, projectName);
    const buildArgs = Object.entries(cloneBuildArgs).map(
        ([key, value]) => `${key}=${value}`,
    );

    return ['topo', 'clone', cloneSourceString, projectPath, ...buildArgs];
};

const getCloneSourceString = (cloneSource: CloneSource): string => {
    switch (cloneSource.type) {
        case 'dir':
            return `dir:${cloneSource.path}`;
        case 'template':
            return `template:${cloneSource.template}`;
        case 'git':
            return `git:${cloneSource.url}`;
        case undefined:
            return cloneSource.value;
    }
};

const cloneWithSource = async (
    workspacePath: string,
    cloneSource: CloneSource,
    defaultProjectName: string,
    cloneBuildArgs: CloneBuildArgs = {},
): Promise<CloneResult> => {
    const projectName = await vscode.window.showInputBox({
        prompt: 'Enter the project name',
        value: defaultProjectName,
    });
    if (!projectName) {
        return { success: false };
    }
    const repositoryPath = path.join(workspacePath, projectName);
    const cloneSourceString = getCloneSourceString(cloneSource);
    const cloneCommand = getCloneCommandFromSourceString(
        workspacePath,
        projectName,
        cloneSourceString,
        cloneBuildArgs,
    );
    const taskName = `Clone ${projectName}`;
    const cloneSucceeded = await executeCloneTask(
        cloneCommand,
        workspacePath,
        taskName,
    );
    if (!cloneSucceeded) {
        return { success: false };
    }
    return { success: true, repositoryPath };
};

const getTemplateOfChoice = async (
    topoCli: TopoCli,
): Promise<TemplateDescription | undefined> => {
    const templates = topoCli.listTemplates();
    const templateItems = templates.map((template) => ({
        label: template.name,
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

export class ProjectClone {
    public static remoteCloneCommand = `${manifest.PACKAGE_NAME}.remoteClone`;
    public static localCloneCommand = `${manifest.PACKAGE_NAME}.localClone`;
    public static templateCloneCommand = `${manifest.PACKAGE_NAME}.templateClone`;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly topoCli: TopoCli,
    ) {}

    private wrapCloneCommandWithCloneErrorHandling(
        commandHandler: (this: ProjectClone) => Promise<void>,
    ): () => Promise<void> {
        return async () => {
            try {
                await commandHandler.call(this);
            } catch (error: unknown) {
                if (!isTopoError(error) || error.code !== 'CLONE') {
                    throw error;
                }
                showAndLogError('Failed to clone project', error);
            }
        };
    }

    public async activate() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                ProjectClone.remoteCloneCommand,
                this.wrapCloneCommandWithCloneErrorHandling(
                    this.cloneRemoteProject,
                ),
            ),
            vscode.commands.registerCommand(
                ProjectClone.localCloneCommand,
                this.wrapCloneCommandWithCloneErrorHandling(
                    this.cloneLocalProject,
                ),
            ),
            vscode.commands.registerCommand(
                ProjectClone.templateCloneCommand,
                this.wrapCloneCommandWithCloneErrorHandling(
                    this.cloneTemplateProject,
                ),
            ),
        );
    }

    public async cloneProjectFromSource(
        workspacePath: string,
        cloneSource: CloneSource,
        cloneBuildArgs: CloneBuildArgs = {},
    ): Promise<boolean> {
        const defaultProjectName =
            getDefaultProjectNameFromSourceString(cloneSource);
        const cloneResult = await cloneWithSource(
            workspacePath,
            cloneSource,
            defaultProjectName,
            cloneBuildArgs,
        );
        if (cloneResult.success) {
            await postCloneAction(cloneResult.repositoryPath);
        }
        return cloneResult.success;
    }

    private async cloneTemplateProject(): Promise<void> {
        const workspacePath = assertWorkspacePath();
        const selectedTemplate = await getTemplateOfChoice(this.topoCli);
        if (!selectedTemplate) {
            return;
        }
        await this.cloneProjectFromSource(
            workspacePath,
            {
                type: 'template',
                template: selectedTemplate.name,
            },
            {},
        );
    }

    private async cloneLocalProject(): Promise<void> {
        const workspacePath = assertWorkspacePath();
        const cloneSourcePath = await getLocalSourcePath();
        if (!cloneSourcePath) {
            return;
        }
        await this.cloneProjectFromSource(
            workspacePath,
            {
                type: 'dir',
                path: cloneSourcePath,
            },
            {},
        );
    }

    private async cloneRemoteProject(): Promise<void> {
        const workspacePath = assertWorkspacePath();
        const cloneSourceRemoteUrl = await vscode.window.showInputBox({
            prompt: 'Enter the git URL to clone from',
        });
        if (!cloneSourceRemoteUrl) {
            return;
        }
        await this.cloneProjectFromSource(
            workspacePath,
            {
                type: 'git',
                url: cloneSourceRemoteUrl,
            },
            {},
        );
    }
}
