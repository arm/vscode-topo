import path from 'node:path';
import os from 'node:os';
import * as vscode from 'vscode';
import { Deploy, deploy } from './deploy';
import { TargetModel } from '../models/targetModel';
import { MockProxy, mock } from 'vitest-mock-extended';
import { mutable } from '../util/test/mutable';
import { TaskExecutor } from '../util/taskExecutor';
import { loaded, unloaded } from '../util/loadable';
import type { TargetHealthReport } from '../services/topoCliSchema';
import { Config } from '../services/config';
import { ProjectController } from '../controllers/projectController';
import { createProjectTreeItem } from '../util/test/projectTreeItem';
import { TopoDeployTaskFactory } from '../tasks/topoDeployTaskFactory';

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
    const targetHealth: TargetHealthReport = {
        destination: `ssh://${target}`,
        isLocalhost: false,
        connectivity: {
            name: 'Connectivity',
            status: 'ok',
            value: 'connected',
        },
        processingDomainDriver: {
            name: 'Processing Domain Driver',
            status: 'ok',
            value: 'ready',
        },
        dependencies: [],
    };
    let taskExecutor: MockProxy<TaskExecutor>;
    let targetModel: TargetModel;
    let projectController: MockProxy<ProjectController>;
    let config: MockProxy<Config>;
    let deployTaskFactory: TopoDeployTaskFactory;

    function expectDeployTask(
        task: vscode.Task,
        composeFile: string,
        args = ['deploy', '--file', 'compose.yaml', '--target', target],
    ): void {
        expect(task.name).toBe(`Deploy ${composeFile} to topo.local`);
        expect(task.definition).toEqual({
            type: deployTaskFactory.type,
            composeFile,
            target,
        });
        expect(task.execution).toMatchObject({
            process: 'topo',
            args,
            options: { cwd: path.dirname(composeFile) },
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
        targetModel.setSelectedTargetHealth(loaded(targetHealth));
        projectController = mock<ProjectController>();
        config = mock<Config>();
        config.getTargetSettings.mockReturnValue({});
        deployTaskFactory = new TopoDeployTaskFactory(config);
        vi.mocked(vscode.workspace.findFiles).mockResolvedValue([]);
        vi.mocked(vscode.workspace.getWorkspaceFolder).mockReturnValue(
            undefined,
        );
        mutable(vscode.workspace).workspaceFolders = undefined;
        deployAction = new Deploy(
            taskExecutor,
            targetModel,
            projectController,
            deployTaskFactory,
        );
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('shows a warning in the command handler with no target selected', async () => {
        targetModel.setSelected(undefined);

        const deployOperation =
            deployAction.deployContextCommandHandler(composeFileUri);

        await expect(deployOperation).resolves.toBeUndefined();
        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            'Cannot deploy. No target selected. Please select a target.',
        );
        expect(taskExecutor.run).not.toHaveBeenCalled();
    });

    it('shows a warning and does not deploy when target connectivity is unhealthy', async () => {
        targetModel.setSelectedTargetHealth(
            loaded({
                ...targetHealth,
                connectivity: {
                    ...targetHealth.connectivity,
                    status: 'error',
                    value: 'unreachable',
                },
            }),
        );

        const deployOperation =
            deployAction.deployContextCommandHandler(composeFileUri);

        await expect(deployOperation).resolves.toBeUndefined();
        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            "Cannot deploy. Target topo.local connectivity is 'error': unreachable.",
        );
        expect(taskExecutor.run).not.toHaveBeenCalled();
    });

    it('shows a warning and does not deploy when target health is loading', async () => {
        targetModel.setSelectedTargetHealth(unloaded(true));

        const deployOperation =
            deployAction.deployContextCommandHandler(composeFileUri);

        await expect(deployOperation).resolves.toBeUndefined();
        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            'Cannot deploy. Target topo.local health is still being checked. Wait for target health checks to finish.',
        );
        expect(taskExecutor.run).not.toHaveBeenCalled();
    });

    it('shows an error when target is selected but no compose files are found', async () => {
        await deployAction.deployCommandHandler();

        expect(vscode.workspace.findFiles).toHaveBeenCalledWith(
            '**/compose.yaml',
        );
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'No compose.yaml files found in the workspace.',
        );
        expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
        expect(taskExecutor.run).not.toHaveBeenCalled();
    });

    it('handles successful deploy operation', async () => {
        await deploy(taskExecutor, deployTaskFactory, {
            composeFilePath,
            target,
        });

        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expectDeployTask(taskExecutor.run.mock.calls[0][0], composeFilePath);
    });

    it('handles task failure', async () => {
        taskExecutor.run.mockRejectedValueOnce(new Error('deploy failed'));
        await deploy(taskExecutor, deployTaskFactory, {
            composeFilePath,
            target,
        });

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Deployment to topo.local failed: deploy failed',
        );
    });

    it('invokes handler when command called', async () => {
        const op = deployAction.deployContextCommandHandler(composeFileUri);

        await expect(op).resolves.toBeUndefined();
        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expectDeployTask(taskExecutor.run.mock.calls[0][0], composeFilePath);
        expect(
            projectController.refreshProjectContainersCommandHandler,
        ).toHaveBeenCalledOnce();
    });

    it('shows an error when selected target settings are invalid', async () => {
        config.getTargetSettings.mockImplementationOnce(() => {
            throw new Error('boom');
        });

        await deployAction.deployContextCommandHandler(composeFileUri);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Deployment to topo.local failed: boom',
        );
        expect(taskExecutor.run).not.toHaveBeenCalled();
    });

    it('deploys the project tree item compose file', async () => {
        await deployAction.deployProjectCommandHandler(
            createProjectTreeItem(composeFileUri),
        );

        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expectDeployTask(taskExecutor.run.mock.calls[0][0], composeFilePath);
    });

    it('throws when context command is called without a resource', async () => {
        await expect(
            deployAction.deployContextCommandHandler(),
        ).rejects.toThrow('No compose.yaml selected for deployment');

        expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
        expect(vscode.workspace.findFiles).not.toHaveBeenCalled();
        expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
        expect(taskExecutor.run).not.toHaveBeenCalled();
    });

    it('throws when project command is called without a project tree item', async () => {
        await expect(
            deployAction.deployProjectCommandHandler(undefined),
        ).rejects.toThrow('This operation cannot be performed on this item');

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
        expectDeployTask(taskExecutor.run.mock.calls[0][0], composeFile.fsPath);
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
