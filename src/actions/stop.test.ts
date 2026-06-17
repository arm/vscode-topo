import path from 'node:path';
import os from 'node:os';
import * as vscode from 'vscode';
import { Stop, stop as stopServices } from './stop';
import { TargetModel } from '../models/targetModel';
import { mock, MockProxy } from 'vitest-mock-extended';
import { TaskExecutor } from '../util/taskExecutor';
import { TargetController } from '../controllers/targetController';
import { ProjectTreeItem } from '../treeItems/projectTreeItem';

describe('Stop', () => {
    let stopAction: Stop;
    const composeFileUri = vscode.Uri.file(
        path.join(os.tmpdir(), 'compose.yaml'),
    );
    const composeFilePath = composeFileUri.fsPath;
    const target = 'topo.local';
    let taskExecutor: MockProxy<TaskExecutor>;
    let targetModel: TargetModel;
    let targetController: MockProxy<TargetController>;

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
        );
    }

    function expectStopTask(task: vscode.Task, cwd: string): void {
        expect(task.name).toBe('Stop services on topo.local');
        expect(task.execution).toMatchObject({
            process: 'topo',
            args: ['stop', '--target', target],
            options: { cwd },
        });
    }

    beforeEach(() => {
        taskExecutor = mock<TaskExecutor>();
        targetModel = new TargetModel();
        targetModel.setSelected(target);
        targetController = mock<TargetController>();
        vi.mocked(vscode.window.showErrorMessage).mockClear();
        stopAction = new Stop(taskExecutor, targetModel, targetController);
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
        expect(taskExecutor.run).not.toHaveBeenCalled();
        expect(
            targetController.refreshSelectedTargetDataCommandHandler,
        ).not.toHaveBeenCalled();
    });

    it('handles successful stop operation', async () => {
        await stopServices(taskExecutor, composeFilePath, target);

        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expectStopTask(
            taskExecutor.run.mock.calls[0][0],
            path.dirname(composeFilePath),
        );
    });

    it('handles task failure', async () => {
        taskExecutor.run.mockRejectedValueOnce(new Error('stop failed'));
        await stopServices(taskExecutor, composeFilePath, target);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Stopping services on topo.local failed: stop failed',
        );
    });

    it('invokes handler when command called', async () => {
        const op = stopAction.stopCommandHandler(composeFileUri);

        await expect(op).resolves.toBeUndefined();
        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expectStopTask(
            taskExecutor.run.mock.calls[0][0],
            path.dirname(composeFilePath),
        );
        expect(
            targetController.refreshSelectedTargetDataCommandHandler,
        ).toHaveBeenCalledOnce();
    });

    it('stops the project tree item compose file', async () => {
        await stopAction.stopProjectCommandHandler(projectTreeItem());

        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expectStopTask(
            taskExecutor.run.mock.calls[0][0],
            path.dirname(composeFilePath),
        );
        expect(
            targetController.refreshSelectedTargetDataCommandHandler,
        ).toHaveBeenCalledOnce();
    });

    it('throws when project command is called without a project tree item', async () => {
        await expect(
            stopAction.stopProjectCommandHandler(undefined),
        ).rejects.toThrow('No compose.yaml or compose.yml selected for stop');

        expect(taskExecutor.run).not.toHaveBeenCalled();
        expect(
            targetController.refreshSelectedTargetDataCommandHandler,
        ).not.toHaveBeenCalled();
    });
});
