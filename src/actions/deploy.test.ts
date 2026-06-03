import path from 'node:path';
import os from 'node:os';
import * as vscode from 'vscode';
import { Deploy, deploy as deployServices } from './deploy';
import { executeTask } from '../util/executeTask';
import { TargetModel } from '../models/targetModel';
import { TopoCli } from '../topoCli';
import { MockProxy, mock } from 'vitest-mock-extended';

vi.mock('../util/logger');
vi.mock('../util/executeTask');

const executeTaskMock = vi.mocked(executeTask);

describe('Deploy', () => {
    let deployAction: Deploy;
    const composeFileUri = vscode.Uri.file(
        path.join(os.tmpdir(), 'compose.yaml'),
    );
    const composeFilePath = composeFileUri.fsPath;
    const target = 'topo.local';
    const topoBinaryPath = '/fake/extension/resources/topo';
    let topoCli: MockProxy<TopoCli>;
    let targetModel: TargetModel;

    beforeEach(() => {
        topoCli = mock<TopoCli>();
        topoCli.getBinaryPath.mockReturnValue(topoBinaryPath);
        targetModel = new TargetModel();
        targetModel.setSelected(target);
        executeTaskMock.mockReset();
        vi.mocked(vscode.window.showErrorMessage).mockClear();
        deployAction = new Deploy(topoCli, targetModel);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('shows an error in the command handler with no target selected', async () => {
        targetModel.setSelected(undefined);

        const deployOperation =
            deployAction.deployCommandHandler(composeFileUri);

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
        const op = deployAction.deployCommandHandler(composeFileUri);

        await expect(op).resolves.toBeUndefined();
        expect(executeTaskMock).toHaveBeenCalledWith(
            'Deploy to topo.local',
            [topoBinaryPath, 'deploy', '--target', 'topo.local'],
            { cwd: path.dirname(composeFilePath) },
        );
    });
});
