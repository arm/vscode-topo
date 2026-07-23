import * as vscode from 'vscode';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { ProtocolHandler } from './protocolHandler';
import { mutable } from './util/test/mutable';
import { showAndLogError } from './util/showAndLog';
import { TaskExecutor } from './util/taskExecutor';
import { MockProxy, mock } from 'vitest-mock-extended';

vi.mock('./util/showAndLog', () => ({
    showAndLogError: vi.fn(),
}));

const showAndLogErrorSpy = vi.mocked(showAndLogError);

const workspacePath = path.resolve('home', 'workspace');
const workspaceUri = vscode.Uri.file(workspacePath);
const workspaceFolders = [{ uri: workspaceUri, name: 'workspace', index: 0 }];
const destinationPath = path.resolve('home', 'destination');
const destinationUri = vscode.Uri.file(destinationPath);

describe('ProtocolHandler', () => {
    let protocolHandler: ProtocolHandler;
    let taskExecutor: MockProxy<TaskExecutor>;

    function expectCloneTask(
        task: vscode.Task,
        projectName: string,
        args: string[],
        cwd?: string,
    ): void {
        expect(task.name).toBe(`Clone ${projectName}`);
        expect(task.execution).toMatchObject({
            process: 'topo',
            args,
            options: { cwd },
        });
    }

    beforeEach(() => {
        vi.resetAllMocks();
        taskExecutor = mock<TaskExecutor>();
        protocolHandler = new ProtocolHandler(taskExecutor);
        mutable(vscode.workspace).workspaceFolders = undefined;
        vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    });

    afterEach(() => vi.restoreAllMocks());

    it('runs a topo clone task for explicit git sources', async () => {
        mutable(vscode.workspace).workspaceFolders = workspaceFolders;
        vi.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce([
            destinationUri,
        ]);

        await protocolHandler.handleUri(
            vscode.Uri.parse(
                'vscode://arm.topo/clone?source=git:https://example.com/virtual-bittermelon-peeler.git',
            ),
        );

        expect(vscode.window.showOpenDialog).toHaveBeenCalledWith({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select Destination Folder',
        });
        expect(fs.existsSync).toHaveBeenCalledWith(
            path.join(destinationUri.fsPath, 'virtual-bittermelon-peeler'),
        );
        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expectCloneTask(
            taskExecutor.run.mock.calls[0][0],
            'virtual-bittermelon-peeler',
            [
                'clone',
                'git:https://example.com/virtual-bittermelon-peeler.git',
                path.join(destinationUri.fsPath, 'virtual-bittermelon-peeler'),
            ],
        );
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
            'Would you like to open the cloned repository, or add it to the current workspace?',
            { modal: true },
            'Open',
            'Open in New Window',
            'Add to Workspace',
        );
        expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    it('prompts for a destination folder when no workspace is open', async () => {
        vi.mocked(vscode.workspace).getWorkspaceFolder.mockReturnValue(
            undefined,
        );
        vi.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce([
            destinationUri,
        ]);

        await protocolHandler.handleUri(
            vscode.Uri.parse(
                'vscode://arm.topo/clone?source=git:https://example.com/virtual-bittermelon-peeler.git',
            ),
        );

        expect(vscode.window.showOpenDialog).toHaveBeenCalledWith({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select Destination Folder',
        });
        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expectCloneTask(
            taskExecutor.run.mock.calls[0][0],
            'virtual-bittermelon-peeler',
            [
                'clone',
                'git:https://example.com/virtual-bittermelon-peeler.git',
                path.join(destinationUri.fsPath, 'virtual-bittermelon-peeler'),
            ],
            os.homedir(),
        );
    });

    it('shows an error when the clone task throws', async () => {
        mutable(vscode.workspace).workspaceFolders = workspaceFolders;
        const err = new Error('task fail');
        taskExecutor.run.mockRejectedValueOnce(err);
        vi.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce([
            destinationUri,
        ]);

        await protocolHandler.handleUri(
            vscode.Uri.parse(
                'vscode://arm.topo/clone?source=git:https://example.com/virtual-bittermelon-peeler.git',
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
        vi.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce([
            destinationUri,
        ]);

        await protocolHandler.handleUri(
            vscode.Uri.parse(
                'vscode://arm.topo/clone?source=https://example.com/virtual-bittermelon-peeler.git&model=some-huggingface-id',
            ),
        );

        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expectCloneTask(
            taskExecutor.run.mock.calls[0][0],
            'virtual-bittermelon-peeler',
            [
                'clone',
                'https://example.com/virtual-bittermelon-peeler.git',
                path.join(destinationUri.fsPath, 'virtual-bittermelon-peeler'),
                'model=some-huggingface-id',
            ],
        );
    });

    it('runs a topo clone task for bare github urls', async () => {
        mutable(vscode.workspace).workspaceFolders = workspaceFolders;
        vi.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce([
            destinationUri,
        ]);

        await protocolHandler.handleUri(
            vscode.Uri.parse(
                'vscode://arm.topo/clone?source=https://github.com/Arm-Examples/topo-lightbulb-moment',
            ),
        );

        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expectCloneTask(
            taskExecutor.run.mock.calls[0][0],
            'topo-lightbulb-moment',
            [
                'clone',
                'https://github.com/Arm-Examples/topo-lightbulb-moment',
                path.join(destinationUri.fsPath, 'topo-lightbulb-moment'),
            ],
        );
    });

    it('stops when destination folder selection is cancelled', async () => {
        mutable(vscode.workspace).workspaceFolders = workspaceFolders;
        vi.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce(
            undefined,
        );

        await protocolHandler.handleUri(
            vscode.Uri.parse(
                'vscode://arm.topo/clone?source=git:https://example.com/virtual-bittermelon-peeler.git',
            ),
        );

        expect(vscode.window.showInputBox).not.toHaveBeenCalled();
        expect(taskExecutor.run).not.toHaveBeenCalled();
    });

    it('does not attempt clone when source is missing', async () => {
        await protocolHandler.handleUri(
            vscode.Uri.parse('vscode://arm.topo/clone?model=test-model'),
        );

        expect(taskExecutor.run).not.toHaveBeenCalled();
        expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
    });

    it('shows an error for unrelated URI paths', async () => {
        const uri = vscode.Uri.parse(
            'vscode://arm.topo/open?source=git:https://example.com',
        );

        await protocolHandler.handleUri(uri);

        expect(taskExecutor.run).not.toHaveBeenCalled();
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
        expect(taskExecutor.run).not.toHaveBeenCalled();
    });
});
