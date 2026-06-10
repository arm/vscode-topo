import path from 'node:path';
import os from 'node:os';
import * as vscode from 'vscode';
import { Deploy, createDeployTask, deploy as deployServices } from './deploy';
import { TargetModel } from '../models/targetModel';
import { MockProxy, mock } from 'vitest-mock-extended';
import { mutable } from '../util/mutable';
import { TaskExecutor } from '../util/taskExecutor';

describe('Deploy', () => {
    let deployAction: Deploy;
    const workspaceUri = vscode.Uri.file('/fake/workspace');
    const workspaceFolders = [
        { uri: workspaceUri, name: 'workspace', index: 0 },
    ];
    const composeFileUri = vscode.Uri.file(
        path.join(os.tmpdir(), 'compose.yaml'),
    );
    const composeFilePath = composeFileUri.fsPath;
    const target = 'topo.local';
    let taskExecutor: MockProxy<TaskExecutor>;
    let targetModel: TargetModel;

    function expectDeployTask(task: vscode.Task, cwd: string): void {
        expect(task.name).toBe('Deploy to topo.local');
        expect(task.presentationOptions).toEqual({
            reveal: vscode.TaskRevealKind.Always,
            echo: true,
            focus: true,
            showReuseMessage: true,
            clear: true,
        });
        expect(task.execution).toMatchObject({
            process: 'topo',
            args: ['deploy', '--target', target],
            options: { cwd },
        });
    }

    function mockWorkspaceFolders(
        workspaceFolders: vscode.WorkspaceFolder[],
    ): void {
        mutable(vscode.workspace).workspaceFolders = workspaceFolders;
        vi.mocked(vscode.workspace.getWorkspaceFolder).mockImplementation(
            (uri) =>
                workspaceFolders.find((workspaceFolder) =>
                    uri.fsPath.startsWith(workspaceFolder.uri.fsPath),
                ),
        );
    }

    beforeEach(() => {
        taskExecutor = mock<TaskExecutor>();
        targetModel = new TargetModel();
        targetModel.setSelected(target);
        vi.mocked(vscode.workspace.findFiles).mockResolvedValue([]);
        vi.mocked(vscode.workspace.getWorkspaceFolder).mockReturnValue(
            undefined,
        );
        mutable(vscode.workspace).workspaceFolders = undefined;
        deployAction = new Deploy(taskExecutor, targetModel);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('shows an error in the command handler with no target selected', async () => {
        targetModel.setSelected(undefined);

        const deployOperation =
            deployAction.deployContextCommandHandler(composeFileUri);

        await expect(deployOperation).resolves.toBeUndefined();
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Error executing deploy command. No target selected. Please select a target before deploying.',
        );
        expect(taskExecutor.run).not.toHaveBeenCalled();
    });

    it('shows an error when target is selected but no compose files are found', async () => {
        await deployAction.deployCommandHandler();

        expect(vscode.workspace.findFiles).toHaveBeenCalledWith(
            '**/compose.{yaml,yml}',
        );
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'No compose.yaml or compose.yml files found in the workspace.',
        );
        expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
        expect(taskExecutor.run).not.toHaveBeenCalled();
    });

    it('builds a deploy task with the topo command name', () => {
        const task = createDeployTask(composeFilePath, target);

        expectDeployTask(task, path.dirname(composeFilePath));
    });

    it('handles successful deploy operation', async () => {
        await deployServices(taskExecutor, composeFilePath, target);

        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expectDeployTask(
            taskExecutor.run.mock.calls[0][0],
            path.dirname(composeFilePath),
        );
    });

    it('handles task failure', async () => {
        taskExecutor.run.mockRejectedValueOnce(new Error('deploy failed'));
        await deployServices(taskExecutor, composeFilePath, target);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Deployment to topo.local failed: deploy failed',
        );
    });

    it('invokes handler when command called', async () => {
        const op = deployAction.deployContextCommandHandler(composeFileUri);

        await expect(op).resolves.toBeUndefined();
        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expectDeployTask(
            taskExecutor.run.mock.calls[0][0],
            path.dirname(composeFilePath),
        );
    });

    it('throws when context command is called without a resource', async () => {
        await expect(
            deployAction.deployContextCommandHandler(),
        ).rejects.toThrow(
            'No compose.yaml or compose.yml selected for deployment',
        );

        expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
        expect(vscode.workspace.findFiles).not.toHaveBeenCalled();
        expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
        expect(taskExecutor.run).not.toHaveBeenCalled();
    });

    it('prompts for and deploys the selected compose file when running the deploy command', async () => {
        mockWorkspaceFolders(workspaceFolders);
        const composeFile = vscode.Uri.file('/fake/workspace/compose.yaml');
        const selectedComposeFile = {
            label: 'compose.yaml',
            description: undefined,
            uri: composeFile,
        };
        vi.mocked(vscode.workspace.findFiles).mockResolvedValueOnce([
            composeFile,
        ]);
        vi.mocked(vscode.window.showQuickPick).mockResolvedValueOnce(
            selectedComposeFile,
        );

        await deployAction.deployCommandHandler();

        expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
            [selectedComposeFile],
            {
                placeHolder: 'Select a compose file to deploy',
            },
        );
        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expectDeployTask(
            taskExecutor.run.mock.calls[0][0],
            workspaceUri.fsPath,
        );
    });

    it('returns without deploying when compose selection is cancelled', async () => {
        mockWorkspaceFolders(workspaceFolders);
        vi.mocked(vscode.workspace.findFiles).mockResolvedValueOnce([
            vscode.Uri.file('/fake/workspace/compose.yaml'),
        ]);
        vi.mocked(vscode.window.showQuickPick).mockResolvedValueOnce(undefined);

        await deployAction.deployCommandHandler();

        expect(taskExecutor.run).not.toHaveBeenCalled();
    });
});
