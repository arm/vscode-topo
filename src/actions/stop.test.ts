import path from 'node:path';
import os from 'node:os';
import * as vscode from 'vscode';
import { Stop, stop } from './stop';
import { TargetModel } from '../models/targetModel';
import { mock, MockProxy } from 'vitest-mock-extended';
import { runTask } from '../util/task';
import { loaded, unloaded } from '../util/loadable';
import type { TargetHealthReport } from '../services/topoCliSchema';
import { createProjectTreeItem } from '../util/test/projectTreeItem';
import { TOPO_TASK_TYPE } from '../manifest';
import { TaskCommand, type TaskFactory } from '../tasks/taskFactory';

vi.mock('../util/task');

const mockRunTask = vi.mocked(runTask);

describe('Stop', () => {
    let stopAction: Stop;
    const composeFileUri = vscode.Uri.file(
        path.join(os.tmpdir(), 'compose.yaml'),
    );
    const composeFile = composeFileUri.fsPath;
    const target = 'topo.local';
    const task = new vscode.Task(
        { type: TOPO_TASK_TYPE },
        vscode.TaskScope.Workspace,
        'Stop task',
        'topo',
    );
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
    let targetModel: TargetModel;
    let taskFactory: MockProxy<TaskFactory>;

    function expectStopTask(): void {
        expect(taskFactory.createTask).toHaveBeenCalledWith(
            `Stop ${composeFile} on ${target}`,
            {
                type: TOPO_TASK_TYPE,
                command: TaskCommand.Stop,
                args: ['--file', 'compose.yaml', '--target', target],
                cwd: path.dirname(composeFile),
            },
        );
        expect(mockRunTask).toHaveBeenCalledWith(task);
    }

    beforeEach(() => {
        vi.clearAllMocks();
        targetModel = new TargetModel();
        targetModel.setSelected(target);
        targetModel.setSelectedTargetHealth(loaded(targetHealth));
        taskFactory = mock<TaskFactory>();
        taskFactory.createTask.mockReturnValue(task);
        vi.mocked(vscode.window.showErrorMessage).mockClear();
        vi.mocked(vscode.window.showWarningMessage).mockClear();
        stopAction = new Stop(targetModel, taskFactory);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('shows a warning in the command handler with no target selected', async () => {
        targetModel.setSelected(undefined);

        const stopOperation = stopAction.stopCommandHandler(composeFileUri);

        await expect(stopOperation).resolves.toBeUndefined();
        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            'Cannot stop. No target selected. Please select a target.',
        );
        expect(mockRunTask).not.toHaveBeenCalled();
    });

    it('shows a warning and does not stop when target connectivity is unhealthy', async () => {
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

        const stopOperation = stopAction.stopCommandHandler(composeFileUri);

        await expect(stopOperation).resolves.toBeUndefined();
        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            "Cannot stop. Target topo.local connectivity is 'error': unreachable.",
        );
        expect(mockRunTask).not.toHaveBeenCalled();
    });

    it('shows a warning and does not stop when target health is loading', async () => {
        targetModel.setSelectedTargetHealth(unloaded(true));

        const stopOperation = stopAction.stopCommandHandler(composeFileUri);

        await expect(stopOperation).resolves.toBeUndefined();
        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            'Cannot stop. Target topo.local health is still being checked. Wait for target health checks to finish.',
        );
        expect(mockRunTask).not.toHaveBeenCalled();
    });

    it('handles task failure', async () => {
        mockRunTask.mockRejectedValueOnce(new Error('stop failed'));
        await stop(taskFactory, composeFile, target);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Stopping services on topo.local failed: stop failed',
        );
    });

    it('invokes handler when command called', async () => {
        const op = stopAction.stopCommandHandler(composeFileUri);

        await expect(op).resolves.toBeUndefined();
        expect(mockRunTask).toHaveBeenCalledTimes(1);
        expectStopTask();
    });

    it('stops the project tree item compose file', async () => {
        await stopAction.stopProjectCommandHandler(
            createProjectTreeItem(composeFileUri),
        );

        expect(mockRunTask).toHaveBeenCalledTimes(1);
        expectStopTask();
    });

    it('throws when project command is called without a project tree item', async () => {
        await expect(
            stopAction.stopProjectCommandHandler(undefined),
        ).rejects.toThrow('This operation cannot be performed on this item');

        expect(mockRunTask).not.toHaveBeenCalled();
    });
});
