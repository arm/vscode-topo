import * as manifest from './manifest';
import * as vscode from 'vscode';
import { CloneSource, TopoCli } from './topoCli';
import * as path from 'node:path';
import { TemplateDescription } from './topoCliSchema';
import { isWrappedError, WrappedError } from './errors/wrappedError';
import { showAndLogError } from './util/showAndLogError';
import { TargetStore } from './workloadPlacement/targetStore';
import { getCloneDestinationPath } from './util/getCloneDestinationPath';
import { executeTask } from './util/executeTask';
import { getErrorMessage } from './util/getErrorMessage';

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
    if (vscode.workspace.workspaceFolders?.length) {
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
            throw new WrappedError('CLONE', `Invalid URL: ${url}`);
        }
    }
    const defaultProjectName = pathname
        .split('/')
        .filter(Boolean)
        .pop()
        ?.replace(/\.git$/, '');
    if (!defaultProjectName) {
        throw new WrappedError('CLONE', `Invalid URL: ${url}`);
    }
    return defaultProjectName;
};

const getDefaultProjectNameFromSourceString = (
    cloneSource: CloneSource,
): string => {
    switch (cloneSource.type) {
        case 'dir':
            return path.basename(cloneSource.path);
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
        case 'git':
            return `git:${cloneSource.url}`;
        case undefined:
            return cloneSource.value;
    }
};

const cloneWithSource = async (
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
    const workspacePath = await getCloneDestinationPath();
    if (!workspacePath) {
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
    try {
        await executeTask(`Clone ${projectName}`, cloneCommand);
        return { success: true, repositoryPath };
    } catch (err) {
        throw new WrappedError('CLONE', getErrorMessage(err), [], {
            cause: err,
        });
    }
};

const getTemplateOfChoice = async (
    topoCli: TopoCli,
    sshTarget?: string,
): Promise<TemplateDescription | undefined> => {
    const templates = topoCli.listTemplates(sshTarget);
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
        private readonly targetStore: TargetStore,
    ) {}

    private wrapCloneCommandWithCloneErrorHandling(
        commandHandler: (this: ProjectClone) => Promise<void>,
    ): () => Promise<void> {
        return async () => {
            try {
                await commandHandler.call(this);
            } catch (error: unknown) {
                if (isWrappedError(error, ['CLONE', 'CLI'])) {
                    return showAndLogError('Failed to clone project', error);
                }
                throw error;
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
        cloneSource: CloneSource,
        cloneBuildArgs: CloneBuildArgs = {},
    ): Promise<boolean> {
        const defaultProjectName =
            getDefaultProjectNameFromSourceString(cloneSource);
        const cloneResult = await cloneWithSource(
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
        const selectedTarget = await this.targetStore.getSelectedTarget();
        const selectedTemplate = await getTemplateOfChoice(
            this.topoCli,
            selectedTarget,
        );
        if (!selectedTemplate) {
            return;
        }
        await this.cloneProjectFromSource(
            {
                type: 'git',
                url: selectedTemplate.url,
            },
            {},
        );
    }

    private async cloneLocalProject(): Promise<void> {
        const cloneSourcePath = await getLocalSourcePath();
        if (!cloneSourcePath) {
            return;
        }
        await this.cloneProjectFromSource(
            {
                type: 'dir',
                path: cloneSourcePath,
            },
            {},
        );
    }

    private async cloneRemoteProject(): Promise<void> {
        const cloneSourceRemoteUrl = await vscode.window.showInputBox({
            prompt: 'Enter the git URL to clone from',
        });
        if (!cloneSourceRemoteUrl) {
            return;
        }
        await this.cloneProjectFromSource(
            {
                type: 'git',
                url: cloneSourceRemoteUrl,
            },
            {},
        );
    }
}
