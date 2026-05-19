import * as vscode from 'vscode';
import { CloneSource } from '../topoCli';
import * as path from 'node:path';
import { WrappedError } from '../errors/wrappedError';
import { getCloneDestinationPath } from './getCloneDestinationPath';
import { executeTask } from './executeTask';
import { getErrorMessage } from './getErrorMessage';

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

export async function cloneProjectFromSource(
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
