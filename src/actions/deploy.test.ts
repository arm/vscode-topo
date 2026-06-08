import path from 'node:path';
import os from 'node:os';
import * as vscode from 'vscode';
import { Deploy, deploy as deployServices } from './deploy';
import { executeTask } from '../util/executeTask';
import { TargetModel } from '../models/targetModel';
import { TopoCli } from '../topoCli';
import { MockProxy, mock } from 'vitest-mock-extended';
import { mutable } from '../util/mutable';

vi.mock('../util/logger');
vi.mock('../util/executeTask');

const executeTaskMock = vi.mocked(executeTask);

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
    const topoBinaryPath = '/fake/extension/resources/topo';
    let topoCli: MockProxy<TopoCli>;
    let targetModel: TargetModel;

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
        topoCli = mock<TopoCli>();
        topoCli.getBinaryPath.mockReturnValue(topoBinaryPath);
        targetModel = new TargetModel();
        targetModel.setSelected(target);
        executeTaskMock.mockReset();
        vi.mocked(vscode.workspace.findFiles).mockReset();
        vi.mocked(vscode.workspace.findFiles).mockResolvedValue([]);
        vi.mocked(vscode.workspace.getWorkspaceFolder).mockReset();
        vi.mocked(vscode.workspace.getWorkspaceFolder).mockReturnValue(
            undefined,
        );
        vi.mocked(vscode.window.showQuickPick).mockReset();
        vi.mocked(vscode.window.showErrorMessage).mockClear();
        mutable(vscode.workspace).workspaceFolders = undefined;
        deployAction = new Deploy(topoCli, targetModel);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('shows an error in the command handler with no target selected', async () => {
        targetModel.setSelected(undefined);

        const deployOperation =
            deployAction.deployContextCommandHandler(composeFileUri);

        await expect(deployOperation).resolves.toBeUndefined();
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Error executing deploy command. No target selected. Please select a target before deploying.',
        );
        expect(executeTaskMock).not.toHaveBeenCalled();
    });

    it('handles successful deploy operation', async () => {
        await deployServices(topoBinaryPath, composeFilePath, target);

        expect(executeTaskMock).toHaveBeenCalledWith(
            'Deploy to topo.local',
            [topoBinaryPath, 'deploy', '--target', 'topo.local'],
            { cwd: path.dirname(composeFilePath) },
        );
    });

    it('handles task failure', async () => {
        executeTaskMock.mockRejectedValueOnce(new Error('deploy failed'));
        await deployServices(topoBinaryPath, composeFilePath, target);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Deployment to topo.local failed: deploy failed',
        );
    });

    it('invokes handler when command called', async () => {
        const op = deployAction.deployContextCommandHandler(composeFileUri);

        await expect(op).resolves.toBeUndefined();
        expect(executeTaskMock).toHaveBeenCalledWith(
            'Deploy to topo.local',
            [topoBinaryPath, 'deploy', '--target', 'topo.local'],
            { cwd: path.dirname(composeFilePath) },
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
        expect(executeTaskMock).not.toHaveBeenCalled();
    });

    it('prompts for a compose file when no resource is provided', async () => {
        mockWorkspaceFolders(workspaceFolders);
        const rootYaml = vscode.Uri.file('/fake/workspace/compose.yaml');
        const rootYml = vscode.Uri.file('/fake/workspace/compose.yml');
        const nestedYaml = vscode.Uri.file(
            '/fake/workspace/services/compose.yaml',
        );
        const nestedYml = vscode.Uri.file('/fake/workspace/a/compose.yml');
        vi.mocked(vscode.workspace.findFiles).mockResolvedValueOnce([
            nestedYaml,
            rootYaml,
            nestedYml,
            rootYml,
        ]);
        vi.mocked(vscode.window.showQuickPick).mockResolvedValueOnce({
            label: 'compose.yaml',
            uri: rootYaml,
        } as never);

        await deployAction.deployCommandHandler();

        expect(vscode.workspace.findFiles).toHaveBeenCalledWith(
            '**/compose.{yaml,yml}',
        );
        const quickPickItems = vi.mocked(vscode.window.showQuickPick).mock
            .calls[0][0] as (vscode.QuickPickItem & { uri: vscode.Uri })[];
        expect(quickPickItems.map((item) => item.label)).toEqual([
            'compose.yaml',
            path.join('a', 'compose.yml'),
            path.join('services', 'compose.yaml'),
        ]);
        expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
            quickPickItems,
            {
                placeHolder: 'Select a compose file to deploy',
            },
        );
        expect(executeTaskMock).toHaveBeenCalledWith(
            'Deploy to topo.local',
            [topoBinaryPath, 'deploy', '--target', 'topo.local'],
            { cwd: workspaceUri.fsPath },
        );
    });

    it('returns without deploying when compose selection is cancelled', async () => {
        mockWorkspaceFolders(workspaceFolders);
        vi.mocked(vscode.workspace.findFiles).mockResolvedValueOnce([
            vscode.Uri.file('/fake/workspace/compose.yaml'),
        ]);
        vi.mocked(vscode.window.showQuickPick).mockResolvedValueOnce(undefined);

        await deployAction.deployCommandHandler();

        expect(executeTaskMock).not.toHaveBeenCalled();
    });

    it('shows an error when no compose files are found', async () => {
        await deployAction.deployCommandHandler();

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Error executing deploy command. No compose.yaml or compose.yml files found in the workspace.',
        );
        expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
        expect(executeTaskMock).not.toHaveBeenCalled();
    });
});
