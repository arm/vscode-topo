import * as vscode from 'vscode';
import { mock, MockProxy } from 'vitest-mock-extended';
import { FixIssue, createFixIssueTask } from './fixIssue';
import { loaded } from '../util/loadable';
import { HealthCheckGroupTreeItem } from '../treeItems/healthCheckGroupTreeItem';
import { HealthCheckTreeItem } from '../treeItems/healthCheckTreeItem';
import { HealthCheck } from '../topoCliSchema';
import { TargetModel } from '../models/targetModel';
import { TaskExecutor } from '../util/taskExecutor';
import { TargetController } from '../controllers/targetController';

vi.mock('../util/logger');

type ShowQuickPickMany = <T extends vscode.QuickPickItem>(
    items: T[],
    options: vscode.QuickPickOptions & { canPickMany: true },
) => Thenable<T[] | undefined>;

const mockSelectedQuickPickItems = <T extends vscode.QuickPickItem>(
    items: T[] | undefined,
) => {
    const showQuickPickMock = vi.mocked<ShowQuickPickMany>(
        vscode.window.showQuickPick,
    );
    showQuickPickMock.mockResolvedValueOnce(items);
};

describe('FixIssue', () => {
    let targetModel: TargetModel;
    let taskExecutor: MockProxy<TaskExecutor>;
    let targetController: MockProxy<TargetController>;

    const target = 'user@topo.local';
    const healthChecks: HealthCheck[] = [
        {
            name: 'Container Engine',
            status: 'error',
            value: 'missing',
            fix: {
                description: 'Install container engine',
                command: `topo install container-engine --target ${target}`,
            },
        },
        {
            name: 'Debugger',
            status: 'warning',
            value: 'missing',
            fix: {
                description: 'Install debugger',
                command: `topo install debugger --target ${target}`,
            },
        },
        {
            name: 'Hardware Info',
            status: 'ok',
            value: 'lscpu',
        },
    ];

    const createFixIssue = (): FixIssue =>
        new FixIssue(taskExecutor, targetModel, targetController);

    const createHealthGroupItem = (
        targetHealthChecks: HealthCheck[],
    ): HealthCheckGroupTreeItem =>
        new HealthCheckGroupTreeItem(loaded(targetHealthChecks));

    beforeEach(() => {
        vi.clearAllMocks();
        taskExecutor = mock<TaskExecutor>();
        targetController = mock<TargetController>();
        targetModel = new TargetModel();
        targetModel.setSelected(target);
    });

    it('builds a fix task with the topo command name', () => {
        const command = healthChecks[1].fix?.command;
        if (!command) {
            throw new Error('Expected debugger health check to include a fix');
        }
        const task = createFixIssueTask(target, ['Debugger'], command);

        expect(task).toMatchObject(
            expect.objectContaining({
                name: `Fix Debugger on ${target}`,
                execution: expect.objectContaining({
                    process: 'topo',
                    args: ['install', 'debugger', '--target', target],
                }),
            }),
        );
    });

    it('runs a single issue fix directly', async () => {
        const fixIssue = createFixIssue();
        const healthCheckItem = new HealthCheckTreeItem(
            loaded(healthChecks[0]),
        );

        await fixIssue.fixIssueCommandHandler(healthCheckItem);

        expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expect(taskExecutor.run).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                execution: expect.objectContaining({
                    args: ['install', 'container-engine', '--target', target],
                }),
            }),
        );
        expect(
            targetController.refreshSelectedTargetDataCommandHandler,
        ).toHaveBeenCalledOnce();
    });

    it('fails a single issue fix without an executable command', async () => {
        const fixIssue = createFixIssue();
        const healthCheckItem = new HealthCheckTreeItem(
            loaded(healthChecks[2]),
        );

        await expect(
            fixIssue.fixIssueCommandHandler(healthCheckItem),
        ).rejects.toThrow('No executable fix found for the selected item');

        expect(taskExecutor.run).not.toHaveBeenCalled();
        expect(
            targetController.refreshSelectedTargetDataCommandHandler,
        ).not.toHaveBeenCalled();
    });

    it('refreshes after a issue fix task fails', async () => {
        taskExecutor.run.mockRejectedValueOnce(new Error('fix failed'));
        const fixIssue = createFixIssue();
        const healthCheckItem = new HealthCheckTreeItem(
            loaded(healthChecks[0]),
        );

        await fixIssue.fixIssueCommandHandler(healthCheckItem);

        expect(taskExecutor.run).toHaveBeenCalledOnce();
        expect(
            targetController.refreshSelectedTargetDataCommandHandler,
        ).toHaveBeenCalledOnce();
    });

    it('fails a single issue fix when no target is selected', async () => {
        targetModel.setSelected(undefined);
        const fixIssue = createFixIssue();
        const healthCheckItem = new HealthCheckTreeItem(
            loaded(healthChecks[0]),
        );

        await expect(
            fixIssue.fixIssueCommandHandler(healthCheckItem),
        ).rejects.toThrow('No selected target found');

        expect(taskExecutor.run).not.toHaveBeenCalled();
        expect(
            targetController.refreshSelectedTargetDataCommandHandler,
        ).not.toHaveBeenCalled();
    });

    it('shows a quick pick when only one target issue fix is available', async () => {
        const fixIssue = createFixIssue();
        const healthGroupItem = createHealthGroupItem([healthChecks[0]]);
        mockSelectedQuickPickItems([
            {
                label: 'Container Engine',
                description: 'Install container engine',
                detail: `Command: topo install container-engine --target ${target}`,
                issue: healthChecks[0],
            },
        ]);

        await fixIssue.fixIssueCommandHandler(healthGroupItem);

        expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
            [
                {
                    label: 'Container Engine',
                    description: 'Install container engine',
                    detail: `Command: topo install container-engine --target ${target}`,
                    issue: healthChecks[0],
                },
            ],
            {
                canPickMany: true,
                placeHolder: `Select fixes for ${target}`,
            },
        );
        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expect(taskExecutor.run).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                execution: expect.objectContaining({
                    args: ['install', 'container-engine', '--target', target],
                }),
            }),
        );
        expect(
            targetController.refreshSelectedTargetDataCommandHandler,
        ).toHaveBeenCalledOnce();
    });

    it('shows target issue fixes in a quick pick and runs the selected fix', async () => {
        const fixIssue = createFixIssue();
        const healthGroupItem = createHealthGroupItem(healthChecks);
        mockSelectedQuickPickItems([
            {
                label: 'Debugger',
                description: 'Install debugger',
                detail: `Command: topo install debugger --target ${target}`,
                issue: healthChecks[1],
            },
        ]);

        await fixIssue.fixIssueCommandHandler(healthGroupItem);

        expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
            [
                {
                    label: 'Container Engine',
                    description: 'Install container engine',
                    detail: `Command: topo install container-engine --target ${target}`,
                    issue: healthChecks[0],
                },
                {
                    label: 'Debugger',
                    description: 'Install debugger',
                    detail: `Command: topo install debugger --target ${target}`,
                    issue: healthChecks[1],
                },
            ],
            {
                canPickMany: true,
                placeHolder: `Select fixes for ${target}`,
            },
        );
        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expect(taskExecutor.run).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                execution: expect.objectContaining({
                    args: ['install', 'debugger', '--target', target],
                }),
            }),
        );
    });

    it('runs each selected target issue fix', async () => {
        const fixIssue = createFixIssue();
        const healthGroupItem = createHealthGroupItem(healthChecks);
        mockSelectedQuickPickItems([
            {
                label: 'Container Engine',
                description: 'Install container engine',
                detail: `Command: topo install container-engine --target ${target}`,
                issue: healthChecks[0],
            },
            {
                label: 'Debugger',
                description: 'Install debugger',
                detail: `Command: topo install debugger --target ${target}`,
                issue: healthChecks[1],
            },
        ]);

        await fixIssue.fixIssueCommandHandler(healthGroupItem);

        expect(taskExecutor.run).toHaveBeenCalledTimes(2);
        expect(taskExecutor.run).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                execution: expect.objectContaining({
                    args: ['install', 'container-engine', '--target', target],
                }),
            }),
        );
        expect(taskExecutor.run).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                execution: expect.objectContaining({
                    args: ['install', 'debugger', '--target', target],
                }),
            }),
        );
        expect(
            targetController.refreshSelectedTargetDataCommandHandler,
        ).toHaveBeenCalledOnce();
    });

    it('runs a shared target issue fix only once', async () => {
        const sharedCommand = `topo install remoteproc --target ${target}`;
        const remoteprocRuntime: HealthCheck = {
            name: 'Remoteproc Runtime',
            status: 'error',
            value: 'missing',
            fix: {
                description: 'Install remoteproc components',
                command: sharedCommand,
            },
        };
        const remoteprocShim: HealthCheck = {
            name: 'Remoteproc Shim',
            status: 'error',
            value: 'missing',
            fix: {
                description: 'Install remoteproc components',
                command: sharedCommand,
            },
        };
        const fixIssue = createFixIssue();
        const healthGroupItem = createHealthGroupItem([
            remoteprocRuntime,
            remoteprocShim,
        ]);
        mockSelectedQuickPickItems([
            {
                label: 'Remoteproc Runtime',
                description: 'Install remoteproc components',
                detail: `Command: ${sharedCommand}`,
                issue: remoteprocRuntime,
            },
            {
                label: 'Remoteproc Shim',
                description: 'Install remoteproc components',
                detail: `Command: ${sharedCommand}`,
                issue: remoteprocShim,
            },
        ]);

        await fixIssue.fixIssueCommandHandler(healthGroupItem);

        expect(taskExecutor.run).toHaveBeenCalledTimes(1);
        expect(taskExecutor.run).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                name: `Fix Remoteproc Runtime, Remoteproc Shim on ${target}`,
                execution: expect.objectContaining({
                    args: ['install', 'remoteproc', '--target', target],
                }),
            }),
        );
    });

    it('refreshes when target issue selection is cancelled', async () => {
        const fixIssue = createFixIssue();
        const healthGroupItem = createHealthGroupItem(healthChecks);
        mockSelectedQuickPickItems([]);

        await fixIssue.fixIssueCommandHandler(healthGroupItem);

        expect(taskExecutor.run).not.toHaveBeenCalled();
        expect(
            targetController.refreshSelectedTargetDataCommandHandler,
        ).toHaveBeenCalledOnce();
    });

    it('fails when a target has no executable issue fixes', async () => {
        const fixIssue = createFixIssue();
        const healthGroupItem = createHealthGroupItem([healthChecks[2]]);

        await expect(
            fixIssue.fixIssueCommandHandler(healthGroupItem),
        ).rejects.toThrow(
            `No executable issue fixes found for target ${target}`,
        );

        expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
        expect(taskExecutor.run).not.toHaveBeenCalled();
        expect(
            targetController.refreshSelectedTargetDataCommandHandler,
        ).not.toHaveBeenCalled();
    });

    it('fails when the command is called with an unsupported item', async () => {
        const fixIssue = createFixIssue();

        await expect(
            fixIssue.fixIssueCommandHandler({ unexpected: true }),
        ).rejects.toThrow(
            'Invalid item for fix issues: expected HealthCheckGroupTreeItem or HealthCheckTreeItem but received:',
        );
    });

    it('fails when the command is called without an item', async () => {
        const fixIssue = createFixIssue();

        await expect(
            fixIssue.fixIssueCommandHandler(undefined),
        ).rejects.toThrow(
            'Invalid item for fix issues: expected HealthCheckGroupTreeItem or HealthCheckTreeItem but received: undefined',
        );
    });
});
