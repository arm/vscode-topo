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
    CONFIG_TARGET_SETTINGS,
    CONFIG_TARGET_SETTINGS_DEPLOY,
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

    function mockTargetDeploySettings(
        deploySettingsByTarget: Record<string, unknown>,
    ): void {
        const targetSettings = Object.fromEntries(
            Object.entries(deploySettingsByTarget).map(
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

    function expectInvalidTargetDeploySettings(
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
            port: '5000',
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
            port: '5000',
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

    it('builds deploy arguments with no recreate enabled', () => {
        const args = buildDeployArgs(target, {
            noRecreate: true,
        });

        expect(args).toEqual(['deploy', '--target', target, '--no-recreate']);
    });

    it('throws when deploy arguments contain conflicting recreate options', () => {
        expect(() =>
            buildDeployArgs(target, {
                forceRecreate: true,
                noRecreate: true,
            }),
        ).toThrow('Cannot use both force recreate and no recreate');
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
        mockTargetDeploySettings({
            [target]: {
                port: ' 5000 ',
                forceRecreate: false,
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
        mockTargetDeploySettings({
            [target]: {
                port: '',
                forceRecreate: true,
                noRecreate: false,
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

    it('passes no recreate from the command handler', async () => {
        mockTargetDeploySettings({
            [target]: {
                port: '',
                forceRecreate: false,
                noRecreate: true,
            },
        });

        await deployAction.deployContextCommandHandler(composeFileUri);

        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expectDeployTask(
            taskExecutor.run.mock.calls[0][0],
            path.dirname(composeFilePath),
            ['deploy', '--target', target, '--no-recreate'],
        );
    });

    it('uses code defaults when the target has no settings entry', async () => {
        mockTargetDeploySettings({});

        await deployAction.deployContextCommandHandler(composeFileUri);

        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expectDeployTask(
            taskExecutor.run.mock.calls[0][0],
            path.dirname(composeFilePath),
        );
    });

    it('uses code defaults when the target has no deploy settings', async () => {
        mockDeployConfiguration({
            [CONFIG_TARGET_SETTINGS]: {
                [target]: {},
            },
        });

        await deployAction.deployContextCommandHandler(composeFileUri);

        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expectDeployTask(
            taskExecutor.run.mock.calls[0][0],
            path.dirname(composeFilePath),
        );
    });

    it('uses code defaults for missing target-specific fields', async () => {
        mockTargetDeploySettings({
            [target]: {
                port: '5003',
            },
        });

        await deployAction.deployContextCommandHandler(composeFileUri);

        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expectDeployTask(
            taskExecutor.run.mock.calls[0][0],
            path.dirname(composeFilePath),
            ['deploy', '--target', target, '-p', '5003'],
        );
    });

    it('uses selected target settings when another target has malformed settings', async () => {
        mockTargetDeploySettings({
            [target]: {
                port: '5003',
            },
            'other.local': {
                port: 5004,
                forceRecreate: 'yes',
            },
        });

        await deployAction.deployContextCommandHandler(composeFileUri);

        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expectDeployTask(
            taskExecutor.run.mock.calls[0][0],
            path.dirname(composeFilePath),
            ['deploy', '--target', target, '-p', '5003'],
        );
    });

    it('shows an error when selected target settings are malformed', async () => {
        mockTargetDeploySettings({
            [target]: {
                port: 5003,
                forceRecreate: 'yes',
                noRecreate: false,
            },
        });

        await deployAction.deployContextCommandHandler(composeFileUri);

        expectInvalidTargetDeploySettings(
            '`port` is invalid: Expected a string, but received: 5003.',
        );
    });

    it('shows an error when selected target settings contain conflicting recreate options', async () => {
        mockTargetDeploySettings({
            [target]: {
                port: '5010',
                forceRecreate: true,
                noRecreate: true,
            },
        });

        await deployAction.deployContextCommandHandler(composeFileUri);

        expectInvalidTargetDeploySettings(
            '`forceRecreate` and `noRecreate` cannot both be true.',
        );
    });

    it('shows an error when selected target settings contain an invalid port', async () => {
        mockTargetDeploySettings({
            [target]: {
                port: '65536',
                forceRecreate: true,
                noRecreate: false,
            },
        });

        await deployAction.deployContextCommandHandler(composeFileUri);

        expectInvalidTargetDeploySettings(
            '`port` must be empty or an integer from 1 to 65535.',
        );
    });

    it('shows an error when selected target settings contain unknown fields', async () => {
        mockTargetDeploySettings({
            [target]: {
                port: '5007',
                forceRecrate: true,
            },
        });

        await deployAction.deployContextCommandHandler(composeFileUri);

        expectInvalidTargetDeploySettings(
            '`forceRecrate` is not a supported setting. Use only `port`, `forceRecreate`, or `noRecreate`.',
        );
    });

    it('shows an error before prompting when deploy command uses invalid selected target settings', async () => {
        mockTargetDeploySettings({
            [target]: {
                port: 'not-a-port',
            },
        });

        await deployAction.deployCommandHandler();

        expectInvalidTargetDeploySettings(
            '`port` must be empty or an integer from 1 to 65535.',
            'Error retrieving target deploy settings',
        );
        expect(vscode.workspace.findFiles).not.toHaveBeenCalled();
        expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
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
