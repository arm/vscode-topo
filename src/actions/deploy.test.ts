import path from 'node:path';
import os from 'node:os';
import * as vscode from 'vscode';
import { Deploy, buildDeployArgs, deploy as deployServices } from './deploy';
import { TargetModel } from '../models/targetModel';
import { MockProxy, mock } from 'vitest-mock-extended';
import { mutable } from '../util/test/mutable';
import { TaskExecutor } from '../util/taskExecutor';
import { ProjectController } from '../controllers/projectController';
import { ProjectTreeItem } from '../views/treeItems/projectTreeItem';
import { unloaded } from '../util/loadable';
import {
    CONFIG_DEFAULT_TARGET_DEPLOY_SETTINGS,
    CONFIG_TARGET_DEPLOY_SETTINGS,
} from '../manifest';

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
    let projectController: MockProxy<ProjectController>;

    function projectTreeItem(): ProjectTreeItem {
        return new ProjectTreeItem(
            {
                name: 'demo',
                uri: vscode.Uri.file(path.dirname(composeFilePath)),
                composeFileUri,
                workspaceIndex: 0,
                workspaceName: 'workspace',
            },
            false,
            unloaded(),
        );
    }

    function expectDeployTask(
        task: vscode.Task,
        cwd: string,
        args = ['deploy', '--target', target],
    ): void {
        expect(task.name).toBe('Deploy to topo.local');
        expect(task.execution).toMatchObject({
            process: 'topo',
            args,
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

    function mockDeployConfiguration(settings: Record<string, unknown>): void {
        vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
            get: vi.fn((key: string) => settings[key]),
        } as unknown as vscode.WorkspaceConfiguration);
    }

    beforeEach(() => {
        taskExecutor = mock<TaskExecutor>();
        targetModel = new TargetModel();
        targetModel.setSelected(target);
        projectController = mock<ProjectController>();
        vi.mocked(vscode.workspace.findFiles).mockResolvedValue([]);
        vi.mocked(vscode.workspace.getWorkspaceFolder).mockReturnValue(
            undefined,
        );
        mutable(vscode.workspace).workspaceFolders = undefined;
        deployAction = new Deploy(taskExecutor, targetModel, projectController);
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
        expect(
            projectController.refreshProjectContainersCommandHandler,
        ).not.toHaveBeenCalled();
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
        expect(
            projectController.refreshProjectContainersCommandHandler,
        ).not.toHaveBeenCalled();
    });

    it('handles successful deploy operation', async () => {
        await deployServices(taskExecutor, composeFilePath, target);

        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expectDeployTask(
            taskExecutor.run.mock.calls[0][0],
            path.dirname(composeFilePath),
        );
    });

    it('passes the custom registry port to deploy', async () => {
        await deployServices(taskExecutor, composeFilePath, target, {
            customRegistryPort: '5000',
        });

        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expectDeployTask(
            taskExecutor.run.mock.calls[0][0],
            path.dirname(composeFilePath),
            ['deploy', '--target', target, '-p', '5000'],
        );
    });

    it('builds deploy arguments without unset options', () => {
        const args = buildDeployArgs(target);

        expect(args).toEqual(['deploy', '--target', target]);
    });

    it('builds deploy arguments with configured options', () => {
        const args = buildDeployArgs(target, {
            customRegistryPort: '5000',
        });

        expect(args).toEqual(['deploy', '--target', target, '-p', '5000']);
    });

    it('builds deploy arguments with force recreate enabled', () => {
        const args = buildDeployArgs(target, {
            forceRecreate: true,
        });

        expect(args).toEqual([
            'deploy',
            '--target',
            target,
            '--force-recreate',
        ]);
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
        expect(
            projectController.refreshProjectContainersCommandHandler,
        ).toHaveBeenCalledOnce();
    });

    it('passes the configured custom registry port from the command handler', async () => {
        mockDeployConfiguration({
            [CONFIG_TARGET_DEPLOY_SETTINGS]: {
                [target]: {
                    port: ' 5000 ',
                    forceRecreate: false,
                },
            },
        });

        await deployAction.deployContextCommandHandler(composeFileUri);

        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expectDeployTask(
            taskExecutor.run.mock.calls[0][0],
            path.dirname(composeFilePath),
            ['deploy', '--target', target, '-p', '5000'],
        );
    });

    it('passes force recreate from the command handler', async () => {
        mockDeployConfiguration({
            [CONFIG_DEFAULT_TARGET_DEPLOY_SETTINGS]: {
                port: '5000',
                forceRecreate: false,
            },
            [CONFIG_TARGET_DEPLOY_SETTINGS]: {
                [target]: {
                    port: '',
                    forceRecreate: true,
                },
            },
        });

        await deployAction.deployContextCommandHandler(composeFileUri);

        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expectDeployTask(
            taskExecutor.run.mock.calls[0][0],
            path.dirname(composeFilePath),
            ['deploy', '--target', target, '--force-recreate'],
        );
    });

    it('falls back to default target settings when the target has no entry', async () => {
        mockDeployConfiguration({
            [CONFIG_DEFAULT_TARGET_DEPLOY_SETTINGS]: {
                port: ' 5001 ',
                forceRecreate: true,
            },
            [CONFIG_TARGET_DEPLOY_SETTINGS]: {},
        });

        await deployAction.deployContextCommandHandler(composeFileUri);

        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expectDeployTask(
            taskExecutor.run.mock.calls[0][0],
            path.dirname(composeFilePath),
            ['deploy', '--target', target, '-p', '5001', '--force-recreate'],
        );
    });

    it('uses default target settings for missing target-specific fields', async () => {
        mockDeployConfiguration({
            [CONFIG_DEFAULT_TARGET_DEPLOY_SETTINGS]: {
                port: '5002',
                forceRecreate: true,
            },
            [CONFIG_TARGET_DEPLOY_SETTINGS]: {
                [target]: {
                    port: '5003',
                },
            },
        });

        await deployAction.deployContextCommandHandler(composeFileUri);

        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expectDeployTask(
            taskExecutor.run.mock.calls[0][0],
            path.dirname(composeFilePath),
            ['deploy', '--target', target, '-p', '5003', '--force-recreate'],
        );
    });

    it('deploys the project tree item compose file', async () => {
        await deployAction.deployProjectCommandHandler(projectTreeItem());

        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expectDeployTask(
            taskExecutor.run.mock.calls[0][0],
            path.dirname(composeFilePath),
        );
        expect(
            projectController.refreshProjectContainersCommandHandler,
        ).toHaveBeenCalledOnce();
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
        expect(
            projectController.refreshProjectContainersCommandHandler,
        ).not.toHaveBeenCalled();
    });

    it('throws when project command is called without a project tree item', async () => {
        await expect(
            deployAction.deployProjectCommandHandler(undefined),
        ).rejects.toThrow(
            'No compose.yaml or compose.yml selected for deployment',
        );

        expect(taskExecutor.run).not.toHaveBeenCalled();
        expect(
            projectController.refreshProjectContainersCommandHandler,
        ).not.toHaveBeenCalled();
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
        expect(
            projectController.refreshProjectContainersCommandHandler,
        ).toHaveBeenCalledOnce();
    });

    it('returns without deploying when compose selection is cancelled', async () => {
        mockWorkspaceFolders(workspaceFolders);
        vi.mocked(vscode.workspace.findFiles).mockResolvedValueOnce([
            vscode.Uri.file('/fake/workspace/compose.yaml'),
        ]);
        vi.mocked(vscode.window.showQuickPick).mockResolvedValueOnce(undefined);

        await deployAction.deployCommandHandler();

        expect(taskExecutor.run).not.toHaveBeenCalled();
        expect(
            projectController.refreshProjectContainersCommandHandler,
        ).not.toHaveBeenCalled();
    });
});
