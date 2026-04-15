import * as vscode from 'vscode';
import path from 'path';
import { mock, MockProxy } from 'jest-mock-extended';
import { ProjectClone } from './projectClone';
import { ProtocolHandler } from './protocolHandler';
import { TopoCli } from './topoCli';
import { mutable } from './util/mutable';
import { showAndLogError } from './util/showAndLogError';
import { TargetStore } from './workloadPlacement/targetStore';

jest.mock('./util/showAndLogError', () => ({
    showAndLogError: jest.fn(),
}));

const showAndLogErrorSpy = jest.mocked(showAndLogError);

const subscriptions: vscode.Disposable[] = [];
const workspacePath = path.join('home', 'workspace');
const workspaceUri = vscode.Uri.file(workspacePath);
const workspaceFolders = [{ uri: workspaceUri, name: 'workspace', index: 0 }];
const destinationPath = path.join('home', 'destination');
const destinationUri = vscode.Uri.file(destinationPath);

const mockTaskEnd = (taskExecution: vscode.TaskExecution, exitCode: number) => {
    jest.mocked(vscode.tasks.executeTask).mockResolvedValueOnce(taskExecution);
    mutable(vscode.tasks).onDidEndTaskProcess = (callback, thisArg) => {
        const listener = thisArg ? callback.bind(thisArg) : callback;
        queueMicrotask(() => {
            listener({
                execution: taskExecution,
                exitCode,
            });
        });
        return { dispose: jest.fn() };
    };
};

describe('ProtocolHandler', () => {
    let projectClone: ProjectClone;
    let protocolHandler: ProtocolHandler;
    let context: MockProxy<vscode.ExtensionContext>;
    const topoCli = mock<TopoCli>();
    const targetStore = mock<TargetStore>();
    const taskExec: vscode.TaskExecution = {
        task: {
            definition: { type: 'shell', taskId: 'topo clone' },
            scope: undefined,
            name: '',
            isBackground: false,
            source: '',
            presentationOptions: {},
            problemMatchers: [],
            runOptions: {},
        },
        terminate: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        context = mock<vscode.ExtensionContext>({
            subscriptions,
        });
        projectClone = new ProjectClone(context, topoCli, targetStore);
        protocolHandler = new ProtocolHandler(projectClone);
        mutable(vscode.workspace).workspaceFolders = undefined;
    });

    it('registers the URI handler on activate', () => {
        protocolHandler.activate(context);

        expect(vscode.window.registerUriHandler).toHaveBeenCalledWith(
            protocolHandler,
        );
        expect(context.subscriptions).toHaveLength(1);
    });

    it('runs a topo clone task for explicit git sources', async () => {
        mutable(vscode.workspace).workspaceFolders = workspaceFolders;
        jest.mocked(vscode.Task).mockReturnValue(taskExec.task);
        mockTaskEnd(taskExec, 0);
        jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce('repo');

        await protocolHandler.handleUri(
            vscode.Uri.parse(
                'vscode://arm.topo/clone?source=git:https://example.com/repo.git',
            ),
        );

        expect(vscode.window.showOpenDialog).not.toHaveBeenCalled();
        expect(vscode.ShellExecution).toHaveBeenCalledWith('topo', [
            'clone',
            'git:https://example.com/repo.git',
            path.join(workspaceUri.fsPath, 'repo'),
        ]);
        expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    it('prompts for a destination folder when no workspace is open', async () => {
        jest.mocked(vscode.workspace).getWorkspaceFolder.mockReturnValue(
            undefined,
        );
        jest.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce([
            destinationUri,
        ]);
        jest.mocked(vscode.Task).mockReturnValue(taskExec.task);
        mockTaskEnd(taskExec, 0);
        jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce('repo');

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
        expect(vscode.ShellExecution).toHaveBeenCalledWith('topo', [
            'clone',
            'git:https://example.com/repo.git',
            path.join(destinationUri.fsPath, 'repo'),
        ]);
    });

    it('shows an error when the clone task fails', async () => {
        mutable(vscode.workspace).workspaceFolders = workspaceFolders;
        jest.mocked(vscode.Task).mockReturnValue(taskExec.task);
        mockTaskEnd(taskExec, 1);
        jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce('repo');

        await protocolHandler.handleUri(
            vscode.Uri.parse(
                'vscode://arm.topo/clone?source=git:https://example.com/repo.git',
            ),
        );

        expect(showAndLogErrorSpy).toHaveBeenCalledWith(
            'Failed to clone project',
            expect.objectContaining({
                code: 'CLONE',
                message: expect.stringContaining('exit code 1'),
            }),
        );
    });

    it('forwards arbitrary query params as clone options', async () => {
        mutable(vscode.workspace).workspaceFolders = workspaceFolders;
        jest.mocked(vscode.Task).mockReturnValue(taskExec.task);
        mockTaskEnd(taskExec, 0);
        jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce('repo');

        await protocolHandler.handleUri(
            vscode.Uri.parse(
                'vscode://arm.topo/clone?source=https://example.com/repo.git&model=some-huggingface-id',
            ),
        );

        expect(vscode.ShellExecution).toHaveBeenCalledWith('topo', [
            'clone',
            'https://example.com/repo.git',
            path.join(workspaceUri.fsPath, 'repo'),
            'model=some-huggingface-id',
        ]);
    });

    it('parses HTML-escaped ampersands in query params', async () => {
        mutable(vscode.workspace).workspaceFolders = workspaceFolders;
        jest.mocked(vscode.Task).mockReturnValue(taskExec.task);
        mockTaskEnd(taskExec, 0);
        jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce('repo');

        await protocolHandler.handleUri(
            vscode.Uri.from({
                scheme: 'vscode',
                authority: 'arm.topo',
                path: '/clone',
                query: 'source=https://example.com/repo.git&amp;model=some-huggingface-id&#38;param=v1&#x26;another=val',
            }),
        );

        expect(vscode.ShellExecution).toHaveBeenCalledWith('topo', [
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
        jest.mocked(vscode.Task).mockReturnValue(taskExec.task);
        mockTaskEnd(taskExec, 0);
        jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
            'topo-lightbulb-moment',
        );

        await protocolHandler.handleUri(
            vscode.Uri.parse(
                'vscode://arm.topo/clone?source=https://github.com/Arm-Examples/topo-lightbulb-moment',
            ),
        );

        expect(vscode.ShellExecution).toHaveBeenCalledWith('topo', [
            'clone',
            'https://github.com/Arm-Examples/topo-lightbulb-moment',
            path.join(workspaceUri.fsPath, 'topo-lightbulb-moment'),
        ]);
    });

    it('does not attempt clone when source is missing', async () => {
        await protocolHandler.handleUri(
            vscode.Uri.parse('vscode://arm.topo/clone?model=test-model'),
        );

        expect(vscode.ShellExecution).not.toHaveBeenCalled();
        expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
    });

    it('shows an error for unrelated URI paths', async () => {
        const uri = vscode.Uri.parse(
            'vscode://arm.topo/open?source=git:https://example.com',
        );

        await protocolHandler.handleUri(uri);

        expect(vscode.ShellExecution).not.toHaveBeenCalled();
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
        expect(vscode.ShellExecution).not.toHaveBeenCalled();
        expect(vscode.tasks.executeTask).not.toHaveBeenCalled();
    });

    it('forwards repeated query params as array clone options', async () => {
        mutable(vscode.workspace).workspaceFolders = workspaceFolders;
        jest.mocked(vscode.Task).mockReturnValue(taskExec.task);
        mockTaskEnd(taskExec, 0);
        jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce('repo');

        await protocolHandler.handleUri(
            vscode.Uri.parse(
                `vscode://arm.topo/clone?source=https://github.com/Arm-Examples/topo-lightbulb-moment&param=v1&param=v2`,
            ),
        );

        expect(vscode.ShellExecution).toHaveBeenCalledWith('topo', [
            'clone',
            'https://github.com/Arm-Examples/topo-lightbulb-moment',
            path.join(workspaceUri.fsPath, 'repo'),
            `param=v2`,
        ]);
    });
});
