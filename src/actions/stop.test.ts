import path from 'node:path';
import os from 'node:os';
import * as vscode from 'vscode';
import { Stop, stop as stopServices } from './stop';
import { executeTask } from '../util/executeTask';
import { TargetModel } from '../models/targetModel';
import { TopoCli } from '../topoCli';
import { mock, MockProxy } from 'vitest-mock-extended';

vi.mock('../util/logger');
vi.mock('../util/executeTask');

const executeTaskMock = vi.mocked(executeTask);

describe('Stop', () => {
    let stopAction: Stop;
    const composeFileUri = vscode.Uri.file(
        path.join(os.tmpdir(), 'compose.yaml'),
    );
    const composeFilePath = composeFileUri.fsPath;
    const target = 'topo.local';
    const topoBinaryPath = '/fake/extension/resources/topo';
    const stopCommand = [topoBinaryPath, 'stop', '--target', target];
    let topoCli: MockProxy<TopoCli>;
    let targetModel: TargetModel;

    beforeEach(() => {
        topoCli = mock<TopoCli>();
        topoCli.getBinaryPath.mockReturnValue(topoBinaryPath);
        topoCli.buildStopCommand.mockReturnValue(stopCommand);
        targetModel = new TargetModel();
        targetModel.setSelected(target);
        executeTaskMock.mockReset();
        vi.mocked(vscode.window.showErrorMessage).mockClear();
        stopAction = new Stop(topoCli, targetModel);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('shows an error in the command handler with no target selected', async () => {
        targetModel.setSelected(undefined);

        const stopOperation = stopAction.stopCommandHandler(composeFileUri);

        await expect(stopOperation).resolves.toBeUndefined();
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Error executing stop command. No target selected. Please select a target before stopping.',
        );
        expect(executeTaskMock).not.toHaveBeenCalled();
    });

    it('handles successful stop operation', async () => {
        await stopServices(topoCli, composeFilePath, target);

        expect(executeTaskMock).toHaveBeenCalledWith(
            'Stop services on topo.local',
            stopCommand,
            { cwd: path.dirname(composeFilePath) },
        );
    });

    it('handles task failure', async () => {
        executeTaskMock.mockRejectedValueOnce(new Error('stop failed'));
        await stopServices(topoCli, composeFilePath, target);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Stopping services on topo.local failed: stop failed',
        );
    });

    it('invokes handler when command called', async () => {
        const op = stopAction.stopCommandHandler(composeFileUri);

        await expect(op).resolves.toBeUndefined();
        expect(executeTaskMock).toHaveBeenCalledWith(
            'Stop services on topo.local',
            stopCommand,
            { cwd: path.dirname(composeFilePath) },
        );
    });
});
