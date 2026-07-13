import path from 'node:path';
import os from 'node:os';
import * as vscode from 'vscode';
import { Stop, stop as stopServices } from './stop';
import { TargetModel } from '../models/targetModel';
import { mock, MockProxy } from 'vitest-mock-extended';
import { TaskExecutor } from '../util/taskExecutor';
import { ProjectController } from '../controllers/projectController';
import { ProjectTreeItem } from '../views/treeItems/projectTreeItem';
import { loaded, unloaded } from '../util/loadable';
import type { TargetHealthReport } from '../services/topoCliSchema';

describe('Stop', () => {
    let stopAction: Stop;
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

    function expectStopTask(
        task: vscode.Task,
        cwd: string,
        selectedComposeFilePath = composeFilePath,
    ): void {
        expect(task.name).toBe('Stop services on topo.local');
        expect(task.execution).toMatchObject({
            process: 'topo',
            args: [
                'stop',
                '--target',
                target,
                '-f',
                path.basename(selectedComposeFilePath),
            ],
            options: { cwd },
        });
    }

    beforeEach(() => {
        taskExecutor = mock<TaskExecutor>();
        targetModel = new TargetModel();
        targetModel.setSelected(target);
        targetModel.setSelectedTargetHealth(loaded(targetHealth));
        projectController = mock<ProjectController>();
        vi.mocked(vscode.window.showErrorMessage).mockClear();
        vi.mocked(vscode.window.showWarningMessage).mockClear();
        stopAction = new Stop(taskExecutor, targetModel, projectController);
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
        expect(
            projectController.refreshProjectContainersCommandHandler,
        ).not.toHaveBeenCalled();
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
        expect(
            projectController.refreshProjectContainersCommandHandler,
        ).not.toHaveBeenCalled();
    });

    it('shows a warning and does not stop when target health is loading', async () => {
        targetModel.setSelectedTargetHealth(unloaded(true));

        const stopOperation = stopAction.stopCommandHandler(composeFileUri);

        await expect(stopOperation).resolves.toBeUndefined();
        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            'Cannot stop. Target topo.local health is still being checked. Wait for target health checks to finish.',
        );
        expect(taskExecutor.run).not.toHaveBeenCalled();
        expect(
            projectController.refreshProjectContainersCommandHandler,
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
            projectController.refreshProjectContainersCommandHandler,
        ).toHaveBeenCalledOnce();
    });

    it('stops the project tree item compose file', async () => {
        await stopAction.stopProjectCommandHandler(projectTreeItem());

        expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expectStopTask(
            taskExecutor.run.mock.calls[0][0],
            path.dirname(composeFilePath),
        );
        expect(
            projectController.refreshProjectContainersCommandHandler,
        ).toHaveBeenCalledOnce();
    });

    it('prompts before stopping a project with multiple Compose files', async () => {
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

        await stopAction.stopProjectCommandHandler(
            projectTreeItem([composeFileUri, developmentFile]),
        );

        expect(vscode.window.showQuickPick).toHaveBeenCalledOnce();
        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expectStopTask(
            taskExecutor.run.mock.calls[0][0],
            path.dirname(developmentFile.fsPath),
            developmentFile.fsPath,
        );
    });

    it('throws when project command is called without a project tree item', async () => {
        await expect(
            stopAction.stopProjectCommandHandler(undefined),
        ).rejects.toThrow('No Compose file selected for stop');

        expect(taskExecutor.run).not.toHaveBeenCalled();
        expect(
            projectController.refreshProjectContainersCommandHandler,
        ).not.toHaveBeenCalled();
    });
});
