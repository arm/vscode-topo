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
import {
    CONFIG_TARGET_SETTINGS,
    CONFIG_TARGET_SETTINGS_DEPLOY,
} from '../manifest';
import { loaded, unloaded } from '../util/loadable';
import type { TargetHealthReport } from '../services/topoCliSchema';

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

    function projectTreeItem(
        composeFileUris: vscode.Uri[] = [composeFileUri],
    ): ProjectTreeItem {
        return new ProjectTreeItem(
            {
                name: 'demo',
                uri: vscode.Uri.file(path.dirname(composeFilePath)),
                composeFileUris,
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
        args = [
            'deploy',
            '--target',
            target,
            '-f',
            path.basename(composeFilePath),
        ],
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

    function mockTargetSettings(
        settingsByTarget: Record<string, unknown>,
    ): void {
        const targetSettings = Object.fromEntries(
            Object.entries(settingsByTarget).map(
                ([targetName, deploySettings]) => [
                    targetName,
                    {
                        [CONFIG_TARGET_SETTINGS_DEPLOY]: deploySettings,
                    },
                ],
            ),
        );

        mockDeployConfiguration({
            [CONFIG_TARGET_SETTINGS]: targetSettings,
        });
    }

    function expectInvalidTargetSettings(
        validationMessage: string,
        errorPrefix = 'Error executing deploy command',
    ): void {
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            `${errorPrefix}. Invalid topo.targetSettings.deploy entry for "topo.local": ${validationMessage}`,
        );
        expect(taskExecutor.run).not.toHaveBeenCalled();
        expect(
            projectController.refreshProjectContainersCommandHandler,
        ).not.toHaveBeenCalled();
    }

    beforeEach(() => {
        taskExecutor = mock<TaskExecutor>();
        targetModel = new TargetModel();
        targetModel.setSelected(target);
        targetModel.setSelectedTargetHealth(loaded(targetHealth));
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

    it('shows a warning in the command handler with no target selected', async () => {
        targetModel.setSelected(undefined);

        const deployOperation =
            deployAction.deployContextCommandHandler(composeFileUri);

        await expect(deployOperation).resolves.toBeUndefined();
        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            'Cannot deploy. No target selected. Please select a target.',
        );
        expect(taskExecutor.run).not.toHaveBeenCalled();
        expect(
            projectController.refreshProjectContainersCommandHandler,
        ).not.toHaveBeenCalled();
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
        expect(
            projectController.refreshProjectContainersCommandHandler,
        ).not.toHaveBeenCalled();
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
        expect(
            projectController.refreshProjectContainersCommandHandler,
        ).not.toHaveBeenCalled();
    });

    it('shows an error when target is selected but no compose files are found', async () => {
        await deployAction.deployCommandHandler();

        expect(vscode.workspace.findFiles).toHaveBeenCalledWith(
            '**/*compose*.{yaml,yml}',
        );
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'No Compose files found in the workspace.',
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
            port: 5000,
        });

        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expectDeployTask(
            taskExecutor.run.mock.calls[0][0],
            path.dirname(composeFilePath),
            [
                'deploy',
                '--target',
                target,
                '-p',
                '5000',
                '-f',
                path.basename(composeFilePath),
            ],
        );
    });

    it('builds deploy arguments without unset options', () => {
        const args = buildDeployArgs(target, composeFilePath);

        expect(args).toEqual([
            'deploy',
            '--target',
            target,
            '-f',
            path.basename(composeFilePath),
        ]);
    });

    it('builds deploy arguments with default settings', () => {
        const args = buildDeployArgs(target, composeFilePath, {});

        expect(args).toEqual([
            'deploy',
            '--target',
            target,
            '-f',
            path.basename(composeFilePath),
        ]);
    });

    it('builds deploy arguments with configured options', () => {
        const args = buildDeployArgs(target, composeFilePath, {
            port: 5000,
        });

        expect(args).toEqual([
            'deploy',
            '--target',
            target,
            '-p',
            '5000',
            '-f',
            path.basename(composeFilePath),
        ]);
    });

    it('builds deploy arguments with force recreate enabled', () => {
        const args = buildDeployArgs(target, composeFilePath, {
            forceRecreate: true,
        });

        expect(args).toEqual([
            'deploy',
            '--target',
            target,
            '--force-recreate',
            '-f',
            path.basename(composeFilePath),
        ]);
    });

    it('builds deploy arguments with no recreate enabled', () => {
        const args = buildDeployArgs(target, composeFilePath, {
            noRecreate: true,
        });

        expect(args).toEqual([
            'deploy',
            '--target',
            target,
            '--no-recreate',
            '-f',
            path.basename(composeFilePath),
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

    it('passes configured deploy arguments from the command handler', async () => {
        mockTargetSettings({
            [target]: {
                port: 5000,
                forceRecreate: true,
                noRecreate: false,
            },
        });

        await deployAction.deployContextCommandHandler(composeFileUri);

        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expectDeployTask(
            taskExecutor.run.mock.calls[0][0],
            path.dirname(composeFilePath),
            [
                'deploy',
                '--target',
                target,
                '-p',
                '5000',
                '--force-recreate',
                '-f',
                path.basename(composeFilePath),
            ],
        );
    });

    it('shows an error before prompting when deploy command uses invalid selected target settings', async () => {
        mockTargetSettings({
            [target]: {
                port: 'not-a-port',
            },
        });

        await deployAction.deployCommandHandler();

        expectInvalidTargetSettings(
            'Expected an integer, but received: "not-a-port"',
            'Error retrieving target settings',
        );
        expect(vscode.workspace.findFiles).not.toHaveBeenCalled();
        expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
    });

    it('deploys the project tree item compose file', async () => {
        await deployAction.deployProjectCommandHandler(projectTreeItem());

        expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expectDeployTask(
            taskExecutor.run.mock.calls[0][0],
            path.dirname(composeFilePath),
        );
        expect(
            projectController.refreshProjectContainersCommandHandler,
        ).toHaveBeenCalledOnce();
    });

    it('prompts before deploying a project with multiple Compose files', async () => {
        const developmentFile = vscode.Uri.file(
            path.join(
                path.dirname(composeFilePath),
                'compose-development.yaml',
            ),
        );
        const selectedComposeFile = {
            label: path.basename(developmentFile.fsPath),
            uri: developmentFile,
        };
        vi.mocked(vscode.window.showQuickPick).mockResolvedValueOnce(
            selectedComposeFile,
        );

        await deployAction.deployProjectCommandHandler(
            projectTreeItem([composeFileUri, developmentFile]),
        );

        expect(vscode.window.showQuickPick).toHaveBeenCalledOnce();
        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expectDeployTask(
            taskExecutor.run.mock.calls[0][0],
            path.dirname(developmentFile.fsPath),
            [
                'deploy',
                '--target',
                target,
                '-f',
                path.basename(developmentFile.fsPath),
            ],
        );
    });

    it('throws when context command is called without a resource', async () => {
        await expect(
            deployAction.deployContextCommandHandler(),
        ).rejects.toThrow('No Compose file selected for deployment');

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
        ).rejects.toThrow('No Compose file selected for deployment');

        expect(taskExecutor.run).not.toHaveBeenCalled();
        expect(
            projectController.refreshProjectContainersCommandHandler,
        ).not.toHaveBeenCalled();
    });

    it('deploys the only Compose file without prompting', async () => {
        mockWorkspaceFolders(workspaceFolders);
        const composeFile = vscode.Uri.file('/fake/workspace/compose.yaml');
        vi.mocked(vscode.workspace.findFiles).mockResolvedValueOnce([
            composeFile,
        ]);

        await deployAction.deployCommandHandler();

        expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expectDeployTask(
            taskExecutor.run.mock.calls[0][0],
            workspaceUri.fsPath,
        );
        expect(
            projectController.refreshProjectContainersCommandHandler,
        ).toHaveBeenCalledOnce();
    });

    it('prompts when the deploy command finds multiple Compose files', async () => {
        mockWorkspaceFolders(workspaceFolders);
        const composeFile = vscode.Uri.file('/fake/workspace/compose.yaml');
        const developmentFile = vscode.Uri.file(
            '/fake/workspace/compose-development.yaml',
        );
        const selectedComposeFile = {
            label: 'compose-development.yaml',
            description: undefined,
            uri: developmentFile,
        };
        vi.mocked(vscode.workspace.findFiles).mockResolvedValueOnce([
            composeFile,
            developmentFile,
        ]);
        vi.mocked(vscode.window.showQuickPick).mockResolvedValueOnce(
            selectedComposeFile,
        );

        await deployAction.deployCommandHandler();

        expect(vscode.window.showQuickPick).toHaveBeenCalledOnce();
        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expectDeployTask(
            taskExecutor.run.mock.calls[0][0],
            workspaceUri.fsPath,
            ['deploy', '--target', target, '-f', 'compose-development.yaml'],
        );
    });

    it('returns without deploying when compose selection is cancelled', async () => {
        mockWorkspaceFolders(workspaceFolders);
        vi.mocked(vscode.workspace.findFiles).mockResolvedValueOnce([
            vscode.Uri.file('/fake/workspace/compose.yaml'),
            vscode.Uri.file('/fake/workspace/compose-development.yaml'),
        ]);
        vi.mocked(vscode.window.showQuickPick).mockResolvedValueOnce(undefined);

        await deployAction.deployCommandHandler();

        expect(taskExecutor.run).not.toHaveBeenCalled();
        expect(
            projectController.refreshProjectContainersCommandHandler,
        ).not.toHaveBeenCalled();
    });
});
