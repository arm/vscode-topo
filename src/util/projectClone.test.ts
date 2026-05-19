import path from 'node:path';
import * as vscode from 'vscode';
import { mutable } from './mutable';
import { executeTask } from './executeTask';
import { cloneProjectFromSource } from './projectClone';

jest.mock('./executeTask');

const executeTaskMock = jest.mocked(executeTask);

const workspacePath = path.join('home', 'workspace');
const workspaceUri = vscode.Uri.file(workspacePath);
const workspaceFolder = { uri: workspaceUri, name: 'workspace', index: 0 };
const destinationPath = path.join('home', 'destination');
const destinationUri = vscode.Uri.file(destinationPath);

type ShowInformationMessageWithStrings = (
    message: string,
    options: vscode.MessageOptions,
    ...items: string[]
) => Thenable<string | undefined>;

const showInformationMessageMock = () =>
    jest.mocked(
        vscode.window.showInformationMessage,
    ) as unknown as jest.MockedFunction<ShowInformationMessageWithStrings>;

describe('cloneProjectFromSource', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        executeTaskMock.mockReset();
        jest.mocked(vscode.window.showInputBox).mockReset();
        jest.mocked(vscode.window.showOpenDialog).mockReset();
        showInformationMessageMock().mockReset();
        mutable(vscode.workspace).workspaceFolders = undefined;
    });

    it('returns false when project name entry is cancelled', async () => {
        mutable(vscode.workspace).workspaceFolders = [workspaceFolder];
        jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
            undefined,
        );

        const cloneStarted = await cloneProjectFromSource({
            type: 'git',
            url: 'https://example.com/repo.git',
        });

        expect(cloneStarted).toBe(false);
        expect(vscode.window.showOpenDialog).not.toHaveBeenCalled();
        expect(executeTaskMock).not.toHaveBeenCalled();
    });

    it('returns false when destination folder selection is cancelled', async () => {
        jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce('repo');
        jest.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce(
            undefined,
        );

        const cloneStarted = await cloneProjectFromSource({
            type: 'git',
            url: 'https://example.com/repo.git',
        });

        expect(cloneStarted).toBe(false);
        expect(vscode.window.showOpenDialog).toHaveBeenCalledWith({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select Destination Folder',
        });
        expect(executeTaskMock).not.toHaveBeenCalled();
        expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
    });

    it('runs a topo clone task for an HTTPS git source', async () => {
        mutable(vscode.workspace).workspaceFolders = [workspaceFolder];
        jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce('repo');
        showInformationMessageMock().mockResolvedValueOnce(undefined);

        const cloneStarted = await cloneProjectFromSource({
            type: 'git',
            url: 'https://example.com/repo.git',
        });

        expect(cloneStarted).toBe(true);
        expect(vscode.window.showInputBox).toHaveBeenCalledWith({
            prompt: 'Enter the project name',
            value: 'repo',
        });
        expect(executeTaskMock).toHaveBeenCalledWith('Clone repo', [
            'topo',
            'clone',
            'git:https://example.com/repo.git',
            path.join(workspaceUri.fsPath, 'repo'),
        ]);
    });

    it('runs a topo clone task for an SSH git source', async () => {
        mutable(vscode.workspace).workspaceFolders = [workspaceFolder];
        jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce('repo');
        showInformationMessageMock().mockResolvedValueOnce(undefined);

        await cloneProjectFromSource({
            type: 'git',
            url: 'git@example.com:owner/repo.git',
        });

        expect(executeTaskMock).toHaveBeenCalledWith('Clone repo', [
            'topo',
            'clone',
            'git:git@example.com:owner/repo.git',
            path.join(workspaceUri.fsPath, 'repo'),
        ]);
    });

    it('runs a topo clone task for a local directory source', async () => {
        mutable(vscode.workspace).workspaceFolders = [workspaceFolder];
        jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce('myproj');
        showInformationMessageMock().mockResolvedValueOnce(undefined);

        await cloneProjectFromSource({
            type: 'dir',
            path: '/path/to/source',
        });

        expect(vscode.window.showInputBox).toHaveBeenCalledWith({
            prompt: 'Enter the project name',
            value: 'source',
        });
        expect(executeTaskMock).toHaveBeenCalledWith('Clone myproj', [
            'topo',
            'clone',
            'dir:/path/to/source',
            path.join(workspaceUri.fsPath, 'myproj'),
        ]);
    });

    it('passes raw clone sources and arbitrary clone options through to topo clone', async () => {
        mutable(vscode.workspace).workspaceFolders = [workspaceFolder];
        jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce('repo');
        showInformationMessageMock().mockResolvedValueOnce(undefined);

        await cloneProjectFromSource(
            { value: 'https://example.com/repo.git' },
            { model: 'some-huggingface-id' },
        );

        expect(executeTaskMock).toHaveBeenCalledWith('Clone repo', [
            'topo',
            'clone',
            'https://example.com/repo.git',
            path.join(workspaceUri.fsPath, 'repo'),
            'model=some-huggingface-id',
        ]);
    });

    it('prompts for a destination folder when no workspace is open', async () => {
        jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce('repo');
        jest.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce([
            destinationUri,
        ]);
        showInformationMessageMock().mockResolvedValueOnce(undefined);

        await cloneProjectFromSource({
            type: 'git',
            url: 'https://example.com/repo.git',
        });

        expect(executeTaskMock).toHaveBeenCalledWith('Clone repo', [
            'topo',
            'clone',
            'git:https://example.com/repo.git',
            path.join(destinationUri.fsPath, 'repo'),
        ]);
    });

    it('throws a clone error when the clone source URL is invalid', async () => {
        await expect(
            cloneProjectFromSource({
                type: 'git',
                url: 'not-a-valid-url',
            }),
        ).rejects.toMatchObject({
            code: 'CLONE',
            message: 'Invalid URL: not-a-valid-url',
        });

        expect(vscode.window.showInputBox).not.toHaveBeenCalled();
        expect(executeTaskMock).not.toHaveBeenCalled();
    });

    it('wraps task failures in a clone error', async () => {
        mutable(vscode.workspace).workspaceFolders = [workspaceFolder];
        jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce('repo');
        const error = new Error('task fail');
        executeTaskMock.mockRejectedValueOnce(error);

        await expect(
            cloneProjectFromSource({
                type: 'git',
                url: 'https://example.com/repo.git',
            }),
        ).rejects.toMatchObject({
            code: 'CLONE',
            message: error.message,
        });

        expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
    });

    it('prompts for a post-clone action after starting the clone task', async () => {
        mutable(vscode.workspace).workspaceFolders = [workspaceFolder];
        jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce('repo');
        showInformationMessageMock().mockResolvedValueOnce(undefined);

        await cloneProjectFromSource({
            type: 'git',
            url: 'https://example.com/repo.git',
        });

        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
            'Would you like to open the cloned repository, or add it to the current workspace?',
            { modal: true },
            'Open',
            'Open in New Window',
            'Add to Workspace',
        );
    });

    it('prompts without the workspace option when no workspace is open', async () => {
        jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce('repo');
        jest.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce([
            destinationUri,
        ]);
        showInformationMessageMock().mockResolvedValueOnce(undefined);

        await cloneProjectFromSource({
            type: 'git',
            url: 'https://example.com/repo.git',
        });

        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
            'Would you like to open the cloned repository?',
            { modal: true },
            'Open',
            'Open in New Window',
        );
    });

    it('opens the cloned repository in the current window when user selects Open', async () => {
        mutable(vscode.workspace).workspaceFolders = [workspaceFolder];
        jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce('repo');
        showInformationMessageMock().mockResolvedValueOnce('Open');

        await cloneProjectFromSource({
            type: 'git',
            url: 'https://example.com/repo.git',
        });

        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            'vscode.openFolder',
            vscode.Uri.file(path.join(workspaceUri.fsPath, 'repo')),
            { forceReuseWindow: true },
        );
    });

    it('opens the cloned repository in a new window when user selects Open in New Window', async () => {
        mutable(vscode.workspace).workspaceFolders = [workspaceFolder];
        jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce('repo');
        showInformationMessageMock().mockResolvedValueOnce(
            'Open in New Window',
        );

        await cloneProjectFromSource({
            type: 'git',
            url: 'https://example.com/repo.git',
        });

        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            'vscode.openFolder',
            vscode.Uri.file(path.join(workspaceUri.fsPath, 'repo')),
            { forceNewWindow: true },
        );
    });

    it('adds the cloned repository to the current workspace when user selects Add to Workspace', async () => {
        mutable(vscode.workspace).workspaceFolders = [workspaceFolder];
        jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce('repo');
        showInformationMessageMock().mockResolvedValueOnce('Add to Workspace');

        await cloneProjectFromSource({
            type: 'git',
            url: 'https://example.com/repo.git',
        });

        expect(vscode.workspace.updateWorkspaceFolders).toHaveBeenCalledWith(
            1,
            0,
            { uri: vscode.Uri.file(path.join(workspaceUri.fsPath, 'repo')) },
        );
    });

    it('does nothing when the post-clone action prompt is dismissed', async () => {
        mutable(vscode.workspace).workspaceFolders = [workspaceFolder];
        jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce('repo');
        showInformationMessageMock().mockResolvedValueOnce(undefined);

        await cloneProjectFromSource({
            type: 'git',
            url: 'https://example.com/repo.git',
        });

        expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
        expect(vscode.workspace.updateWorkspaceFolders).not.toHaveBeenCalled();
    });
});
