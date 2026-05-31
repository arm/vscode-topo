import * as vscode from 'vscode';
import path from 'node:path';
import { mock, MockProxy } from 'vitest-mock-extended';
import { ProjectClone } from './projectClone';
import { ProtocolHandler } from './protocolHandler';
import { TopoCli } from './topoCli';
import { mutable } from './util/mutable';
import { showAndLogError } from './util/showAndLogError';
import { executeTask } from './util/executeTask';
import { TargetModel } from './models/targetModel';

vi.mock('./util/showAndLogError', () => ({
    showAndLogError: vi.fn(),
}));
vi.mock('./util/executeTask');

const showAndLogErrorSpy = vi.mocked(showAndLogError);
const executeTaskMock = vi.mocked(executeTask);

const subscriptions: vscode.Disposable[] = [];
const workspacePath = path.join('home', 'workspace');
const workspaceUri = vscode.Uri.file(workspacePath);
const workspaceFolders = [{ uri: workspaceUri, name: 'workspace', index: 0 }];
const destinationPath = path.join('home', 'destination');
const destinationUri = vscode.Uri.file(destinationPath);
const topoBinaryPath = path.join('fake', 'extension', 'resources', 'topo');

describe('ProtocolHandler', () => {
    let projectClone: ProjectClone;
    let protocolHandler: ProtocolHandler;
    const topoCli = mock<TopoCli>();
    const targetModel = new TargetModel();

    beforeEach(() => {
        vi.clearAllMocks();
        const context = mock<vscode.ExtensionContext>();
        topoCli.getBinaryPath.mockReturnValue(topoBinaryPath);
        projectClone = new ProjectClone(context, topoCli, targetModel);
        protocolHandler = new ProtocolHandler(projectClone);
        mutable(vscode.workspace).workspaceFolders = undefined;
    });

    it('runs a topo clone task for explicit git sources', async () => {
        mutable(vscode.workspace).workspaceFolders = workspaceFolders;
        vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce('repo');

        await protocolHandler.handleUri(
            vscode.Uri.parse(
                'vscode://arm.topo/clone?source=git:https://example.com/repo.git',
            ),
        );

        expect(vscode.window.showOpenDialog).not.toHaveBeenCalled();
        expect(executeTaskMock).toHaveBeenCalledWith('Clone repo', [
            topoBinaryPath,
            'clone',
            'git:https://example.com/repo.git',
            path.join(workspaceUri.fsPath, 'repo'),
        ]);
        expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    it('prompts for a destination folder when no workspace is open', async () => {
        vi.mocked(vscode.workspace).getWorkspaceFolder.mockReturnValue(
            undefined,
        );
        vi.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce([
            destinationUri,
        ]);
        vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce('repo');

        await protocolHandler.handleUri(
            vscode.Uri.parse(
                'vscode://arm.topo/clone?source=git:https://example.com/repo.git',
            ),
        );

        expect(vscode.window.showOpenDialog).toHaveBeenCalledWith({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select Destination Folder',
        });
        expect(executeTaskMock).toHaveBeenCalledWith('Clone repo', [
            topoBinaryPath,
            'clone',
            'git:https://example.com/repo.git',
            path.join(destinationUri.fsPath, 'repo'),
        ]);
    });

    it('shows an error when the clone task throws', async () => {
        mutable(vscode.workspace).workspaceFolders = workspaceFolders;
        const err = new Error('task fail');
        executeTaskMock.mockRejectedValueOnce(err);
        vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce('repo');

        await protocolHandler.handleUri(
            vscode.Uri.parse(
                'vscode://arm.topo/clone?source=git:https://example.com/repo.git',
            ),
        );

        expect(showAndLogErrorSpy).toHaveBeenCalledWith(
            'Failed to clone project',
            expect.objectContaining({
                code: 'CLONE',
                message: err.message,
            }),
        );
    });

    it('forwards arbitrary query params as clone options', async () => {
        mutable(vscode.workspace).workspaceFolders = workspaceFolders;
        vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce('repo');

        await protocolHandler.handleUri(
            vscode.Uri.parse(
                'vscode://arm.topo/clone?source=https://example.com/repo.git&model=some-huggingface-id',
            ),
        );

        expect(executeTaskMock).toHaveBeenCalledWith('Clone repo', [
            topoBinaryPath,
            'clone',
            'https://example.com/repo.git',
            path.join(workspaceUri.fsPath, 'repo'),
            'model=some-huggingface-id',
        ]);
    });

    it('parses HTML-escaped ampersands in query params', async () => {
        mutable(vscode.workspace).workspaceFolders = workspaceFolders;
        vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce('repo');

        await protocolHandler.handleUri(
            vscode.Uri.from({
                scheme: 'vscode',
                authority: 'arm.topo',
                path: '/clone',
                query: 'source=https://example.com/repo.git&amp;model=some-huggingface-id&#38;param=v1&#x26;another=val',
            }),
        );

        expect(executeTaskMock).toHaveBeenCalledWith('Clone repo', [
            topoBinaryPath,
            'clone',
            'https://example.com/repo.git',
            path.join(workspaceUri.fsPath, 'repo'),
            'model=some-huggingface-id',
            'param=v1',
            'another=val',
        ]);
    });

    it('runs a topo clone task for bare github urls', async () => {
        mutable(vscode.workspace).workspaceFolders = workspaceFolders;
        vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
            'topo-lightbulb-moment',
        );

        await protocolHandler.handleUri(
            vscode.Uri.parse(
                'vscode://arm.topo/clone?source=https://github.com/Arm-Examples/topo-lightbulb-moment',
            ),
        );

        expect(executeTaskMock).toHaveBeenCalledWith(
            'Clone topo-lightbulb-moment',
            [
                topoBinaryPath,
                'clone',
                'https://github.com/Arm-Examples/topo-lightbulb-moment',
                path.join(workspaceUri.fsPath, 'topo-lightbulb-moment'),
            ],
        );
    });

    it('does not attempt clone when source is missing', async () => {
        await protocolHandler.handleUri(
            vscode.Uri.parse('vscode://arm.topo/clone?model=test-model'),
        );

        expect(executeTaskMock).not.toHaveBeenCalled();
        expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
    });

    it('shows an error for unrelated URI paths', async () => {
        const uri = vscode.Uri.parse(
            'vscode://arm.topo/open?source=git:https://example.com',
        );

        await protocolHandler.handleUri(uri);

        expect(executeTaskMock).not.toHaveBeenCalled();
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            `Invalid URI: ${uri.toString()}`,
        );
    });

    it('shows an error when the source starts with dir:', async () => {
        const uri = vscode.Uri.parse(
            'vscode://arm.topo/clone?source=dir:/tmp/topo-text-classifier',
        );

        await protocolHandler.handleUri(uri);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            `Clone source type 'dir' is not supported for URI-based cloning. Please use the command palette to clone from a local directory. URI: ${uri.toString()}`,
        );
        expect(vscode.window.showOpenDialog).not.toHaveBeenCalled();
        expect(vscode.window.showInputBox).not.toHaveBeenCalled();
        expect(executeTaskMock).not.toHaveBeenCalled();
    });

    it('forwards repeated query params as array clone options', async () => {
        mutable(vscode.workspace).workspaceFolders = workspaceFolders;
        vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce('repo');

        await protocolHandler.handleUri(
            vscode.Uri.parse(
                `vscode://arm.topo/clone?source=https://github.com/Arm-Examples/topo-lightbulb-moment&param=v1&param=v2`,
            ),
        );

        expect(executeTaskMock).toHaveBeenCalledWith('Clone repo', [
            topoBinaryPath,
            'clone',
            'https://github.com/Arm-Examples/topo-lightbulb-moment',
            path.join(workspaceUri.fsPath, 'repo'),
            `param=v2`,
        ]);
    });
});
