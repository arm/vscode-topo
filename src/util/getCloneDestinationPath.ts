import * as vscode from 'vscode';

const getWorkspaceDestinationPath = async (): Promise<string | undefined> => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return undefined;
    }

    if (workspaceFolders.length === 1) {
        return workspaceFolders[0].uri.fsPath;
    }

    const selectedWorkspace = await vscode.window.showWorkspaceFolderPick({
        placeHolder: 'Select destination workspace folder',
    });

    return selectedWorkspace?.uri.fsPath;
};

export const getCloneDestinationPath = async (): Promise<
    string | undefined
> => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        return await getWorkspaceDestinationPath();
    }

    const selectedFolder = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select Destination Folder',
    });

    return selectedFolder?.[0]?.fsPath;
};
