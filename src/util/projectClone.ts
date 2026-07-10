import * as vscode from 'vscode';
import { TopoCli } from '../services/topoCli';
import * as path from 'node:path';
import { ProjectDescription } from '../services/topoCliSchema';
import { isWrappedError, WrappedError } from '../errors/wrappedError';
import { getCloneDestinationPath } from './getCloneDestinationPath';
import { getErrorMessage } from './getErrorMessage';
import { TaskExecutor } from './taskExecutor';
import { createProcessTask } from './task';
import { showAndLogError } from './showAndLog';

interface CloneRemoteSource {
    url: string;
    type: 'git';
}

interface CloneLocalSource {
    path: string;
    type: 'dir';
}

interface CloneRawSource {
    value: string;
    type?: never;
}

export type CloneSource = CloneRemoteSource | CloneLocalSource | CloneRawSource;

type CloneResult =
    | {
          success: true;
          repositoryPath: string;
      }
    | {
          success: false;
      };

type CloneBuildArgs = Record<string, string>;

type RemoteProjectQuickPickItem = vscode.QuickPickItem & {
    url: string;
};

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

export const getLocalSourcePath = async (): Promise<string | undefined> => {
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

export const getDefaultProjectNameFromUrl = (url: string): string => {
    let pathname: string;
    const [urlWithoutFragment] = url.split('#');
    // Support scp-like SSH URLs (e.g. git@host:owner/repo.git)
    const scpMatch = urlWithoutFragment.match(/^(?:[^@]+@)?[^:]+:(.+)$/);
    if (scpMatch) {
        pathname = scpMatch[1];
    } else {
        try {
            pathname = new URL(urlWithoutFragment).pathname;
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

export function createCloneTask(
    projectName: string,
    cloneSource: CloneSource,
    repositoryPath: string,
    cloneBuildArgs: CloneBuildArgs = {},
): vscode.Task {
    const buildArgs = Object.entries(cloneBuildArgs).map(
        ([key, value]) => `${key}=${value}`,
    );
    return createProcessTask(`Clone ${projectName}`, [
        'topo',
        'clone',
        getCloneSourceString(cloneSource),
        repositoryPath,
        ...buildArgs,
    ]);
}

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
    taskExecutor: TaskExecutor,
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
    const cloneTask = createCloneTask(
        projectName,
        cloneSource,
        repositoryPath,
        cloneBuildArgs,
    );
    try {
        await taskExecutor.run(cloneTask);
        return { success: true, repositoryPath };
    } catch (err) {
        throw new WrappedError('CLONE', getErrorMessage(err), [], {
            cause: err,
        });
    }
};

const listProjects = async (
    topoCli: TopoCli,
    sshTarget?: string,
): Promise<ProjectDescription[]> => {
    if (!sshTarget) {
        return topoCli.listProjects();
    }
    try {
        return await topoCli.listProjects(sshTarget);
    } catch (error) {
        if (!isWrappedError(error, ['CLI'])) {
            throw error;
        }
        return topoCli.listProjects();
    }
};

const buildRemoteQuickPickItems = (
    projectItems: RemoteProjectQuickPickItem[],
    filter: string,
): RemoteProjectQuickPickItem[] => {
    const entry = filter.trim();
    if (entry.length > 0) {
        return [
            {
                label: `$(cloud-download) Custom URL`,
                description: entry,
                url: entry,
            },
            ...projectItems,
        ];
    }
    return projectItems;
};

export const promptForRemoteCloneSource = async (
    topoCli: TopoCli,
    sshTarget?: string,
): Promise<CloneSource | undefined> => {
    const quickPick =
        vscode.window.createQuickPick<RemoteProjectQuickPickItem>();
    quickPick.matchOnDescription = true;
    quickPick.busy = true;
    quickPick.title = 'Select a project to clone';
    quickPick.placeholder =
        'Enter a Git repository URL or search the Topo Project catalog';

    return new Promise<CloneSource | undefined>((resolve) => {
        let open = true;
        let projectItems: RemoteProjectQuickPickItem[] = [];

        void (async () => {
            let projects: ProjectDescription[] = [];
            try {
                projects = await listProjects(topoCli, sshTarget);
            } catch (e) {
                showAndLogError('Failed to list projects', e);
            }
            projectItems = projects.map((project) => ({
                label: `$(repo) ${project.name}`,
                detail: getFirstSentence(project.description),
                url: project.url,
            }));
            if (open) {
                quickPick.items = buildRemoteQuickPickItems(
                    projectItems,
                    quickPick.value,
                );
                quickPick.busy = false;
            }
        })();

        quickPick.onDidChangeValue((value) => {
            quickPick.items = buildRemoteQuickPickItems(projectItems, value);
        });

        quickPick.onDidAccept(() => {
            const selectedItem = quickPick.selectedItems[0];
            resolve(
                selectedItem
                    ? { type: 'git', url: selectedItem.url }
                    : undefined,
            );
            quickPick.hide();
        });

        quickPick.onDidHide(() => {
            open = false;
            resolve(undefined);
        });

        quickPick.show();
    }).finally(() => quickPick.dispose());
};

export async function cloneProjectFromSource(
    taskExecutor: TaskExecutor,
    cloneSource: CloneSource,
    cloneBuildArgs: CloneBuildArgs = {},
): Promise<boolean> {
    const defaultProjectName =
        getDefaultProjectNameFromSourceString(cloneSource);
    const cloneResult = await cloneWithSource(
        taskExecutor,
        cloneSource,
        defaultProjectName,
        cloneBuildArgs,
    );
    if (cloneResult.success) {
        await postCloneAction(cloneResult.repositoryPath);
    }
    return cloneResult.success;
}
