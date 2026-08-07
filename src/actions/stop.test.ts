import path from 'node:path';
import os from 'node:os';
import * as vscode from 'vscode';
import { Stop, stop } from './stop';
import { TargetModel } from '../models/targetModel';
import { mock, MockProxy } from 'vitest-mock-extended';
import { TaskExecutor } from '../util/taskExecutor';
import { loaded, unloaded } from '../util/loadable';
import type { TargetHealthReport } from '../services/topoCliSchema';
import { createProjectTreeItem } from '../util/test/projectTreeItem';
import { TOPO_STOP_TASK_TYPE } from '../manifest';
import { StopTaskFactory } from '../tasks/stopTaskFactory';
import type { TopoCli } from '../services/topoCli';

describe('Stop', () => {
    let stopAction: Stop;
    const composeFileUri = vscode.Uri.file(
        path.join(os.tmpdir(), 'compose.yaml'),
    );
    const composeFile = composeFileUri.fsPath;
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
    let taskFactory: StopTaskFactory;
    let topoCli: MockProxy<TopoCli>;

    function expectStopTask(task: vscode.Task, cwd: string): void {
        expect(task.name).toBe(`Stop ${composeFile} on topo.local`);
        expect(task.definition).toEqual({
            type: TOPO_STOP_TASK_TYPE,
            composeFile,
            target,
        });
        expect(task.execution).toMatchObject({
            process: 'topo',
            args: ['stop', '--file', 'compose.yaml', '--target', target],
            options: { cwd },
        });
    }

    beforeEach(() => {
        taskExecutor = mock<TaskExecutor>();
        targetModel = new TargetModel();
        targetModel.setSelected(target);
        targetModel.setSelectedTargetHealth(loaded(targetHealth));
        topoCli = mock<TopoCli>();
        topoCli.getBinaryPath.mockReturnValue('topo');
        taskFactory = new StopTaskFactory(topoCli);
        vi.mocked(vscode.window.showErrorMessage).mockClear();
        vi.mocked(vscode.window.showWarningMessage).mockClear();
        stopAction = new Stop(taskExecutor, targetModel, taskFactory);
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
        expect(taskExecutor.run).not.toHaveBeenCalled();
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
        expect(taskExecutor.run).not.toHaveBeenCalled();
    });

    it('shows a warning and does not stop when target health is loading', async () => {
        targetModel.setSelectedTargetHealth(unloaded(true));

        const stopOperation = stopAction.stopCommandHandler(composeFileUri);

        await expect(stopOperation).resolves.toBeUndefined();
        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            'Cannot stop. Target topo.local health is still being checked. Wait for target health checks to finish.',
        );
        expect(taskExecutor.run).not.toHaveBeenCalled();
    });

    it('handles task failure', async () => {
        taskExecutor.run.mockRejectedValueOnce(new Error('stop failed'));
        await stop(taskExecutor, taskFactory, {
            type: TOPO_STOP_TASK_TYPE,
            composeFile,
            target,
        });

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
            path.dirname(composeFile),
        );
    });

    it('stops the project tree item compose file', async () => {
        await stopAction.stopProjectCommandHandler(
            createProjectTreeItem(composeFileUri),
        );

        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expectStopTask(
            taskExecutor.run.mock.calls[0][0],
            path.dirname(composeFile),
        );
    });

    it('throws when project command is called without a project tree item', async () => {
        await expect(
            stopAction.stopProjectCommandHandler(undefined),
        ).rejects.toThrow('This operation cannot be performed on this item');

        expect(taskExecutor.run).not.toHaveBeenCalled();
    });
});
