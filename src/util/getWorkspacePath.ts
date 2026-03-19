import * as vscode from 'vscode';

export const getWorkspacePath = (): string | undefined => {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
};
