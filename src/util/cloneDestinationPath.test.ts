import * as vscode from 'vscode';
import { mutable } from './test/mutable';
import { getCloneDestinationPath } from './cloneDestinationPath';

const workspaceUri = vscode.Uri.file('/home/workspace');
const secondWorkspaceUri = vscode.Uri.file('/home/workspace-2');
const destinationUri = vscode.Uri.file('/home/destination');

const workspacePath = workspaceUri.fsPath;
const secondWorkspacePath = secondWorkspaceUri.fsPath;
const destinationPath = destinationUri.fsPath;

const workspaceFolders = [
    {
        uri: workspaceUri,
        name: 'workspace',
        index: 0,
    },
    {
        uri: secondWorkspaceUri,
        name: 'workspace-2',
        index: 1,
    },
];

describe('getCloneDestinationPath', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mutable(vscode.workspace).workspaceFolders = undefined;
    });

    it('returns the only open workspace path', async () => {
        mutable(vscode.workspace).workspaceFolders = [workspaceFolders[0]];

        await expect(getCloneDestinationPath()).resolves.toBe(workspacePath);
        expect(vscode.window.showWorkspaceFolderPick).not.toHaveBeenCalled();
        expect(vscode.window.showOpenDialog).not.toHaveBeenCalled();
    });

    it('prompts for a workspace when multiple workspaces are open', async () => {
        mutable(vscode.workspace).workspaceFolders = workspaceFolders;
        vi.mocked(vscode.window.showWorkspaceFolderPick).mockResolvedValueOnce(
            workspaceFolders[1],
        );

        await expect(getCloneDestinationPath()).resolves.toBe(
            secondWorkspacePath,
        );
        expect(vscode.window.showWorkspaceFolderPick).toHaveBeenCalledWith({
            placeHolder: 'Select destination workspace folder',
        });
        expect(vscode.window.showOpenDialog).not.toHaveBeenCalled();
    });

    it('stops when workspace selection is cancelled', async () => {
        mutable(vscode.workspace).workspaceFolders = workspaceFolders;
        vi.mocked(vscode.window.showWorkspaceFolderPick).mockResolvedValueOnce(
            undefined,
        );

        await expect(getCloneDestinationPath()).resolves.toBeUndefined();
        expect(vscode.window.showOpenDialog).not.toHaveBeenCalled();
    });

    it('prompts for a filesystem destination when no workspace is open', async () => {
        vi.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce([
            destinationUri,
        ]);

        await expect(getCloneDestinationPath()).resolves.toBe(destinationPath);
        expect(vscode.window.showOpenDialog).toHaveBeenCalledWith({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select Destination Folder',
        });
        expect(vscode.window.showWorkspaceFolderPick).not.toHaveBeenCalled();
    });

    it('returns undefined when filesystem destination selection is cancelled', async () => {
        vi.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce(
            undefined,
        );

        await expect(getCloneDestinationPath()).resolves.toBeUndefined();
        expect(vscode.window.showWorkspaceFolderPick).not.toHaveBeenCalled();
    });
});
