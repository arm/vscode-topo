import fs from 'node:fs';
import path from 'node:path';
import * as vscode from 'vscode';
import { isWrappedError } from '../errors/wrappedError';
import { TopoCli } from '../services/topoCli';
import { ProjectDescription } from '../services/topoCliSchema';
import { CloneSource, validateProjectName } from './cloneSource';
import { showAndLogError } from './showAndLog';

type RemoteProjectQuickPickItem = vscode.QuickPickItem & {
    url: string;
};

const open = 'Open';
const openNewWindow = 'Open in New Window';
const addToWorkspace = 'Add to Workspace';

export const getFirstSentence = (text: string): string => {
    const trimmed = text.trim();
    const match = trimmed.match(/^.*?[.!?](?=\s|$)/);
    return (match ? match[0] : trimmed).trim();
};

const listProjects = async (
    topoCli: TopoCli,
    sshTarget?: string,
): Promise<readonly ProjectDescription[]> => {
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
            let projects: readonly ProjectDescription[] = [];
            try {
                projects = await listProjects(topoCli, sshTarget);
            } catch (error) {
                showAndLogError('Failed to list projects', error);
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

export const promptForLocalCloneSource = async (): Promise<
    CloneSource | undefined
> => {
    const selection = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select Project to Clone',
    });
    const sourcePath = selection?.[0]?.fsPath;
    return sourcePath ? { type: 'dir', path: sourcePath } : undefined;
};

export const selectDestinationPath = async (): Promise<string | undefined> => {
    const selection = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select Destination Folder',
    });
    return selection?.[0]?.fsPath;
};

export const resolveProjectName = async (
    destinationPath: string,
    defaultProjectName: string,
): Promise<string | undefined> => {
    if (!fs.existsSync(path.join(destinationPath, defaultProjectName))) {
        return defaultProjectName;
    }

    return vscode.window.showInputBox({
        prompt: 'Enter the project name',
        value: defaultProjectName,
        validateInput: validateProjectName,
    });
};

export const handleCompletedClone = async (
    repositoryPath: string,
): Promise<void> => {
    let message = 'Would you like to open the cloned repository?';
    const choices = [open, openNewWindow];

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
            await vscode.commands.executeCommand('vscode.openFolder', uri, {
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
            await vscode.commands.executeCommand('vscode.openFolder', uri, {
                forceNewWindow: true,
            });
            return;
        case undefined:
        default:
            return;
    }
};
