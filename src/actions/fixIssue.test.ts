import * as vscode from 'vscode';
import { mock, MockProxy } from 'vitest-mock-extended';
import { FixIssue, createFixIssueTask } from './fixIssue';
import { loaded } from '../util/loadable';
import { HealthCheckGroupTreeItem } from '../views/treeItems/healthCheckGroupTreeItem';
import { HealthCheckTreeItem } from '../views/treeItems/healthCheckTreeItem';
import { HealthCheck } from '../services/topoCliSchema';
import { TargetModel } from '../models/targetModel';
import { refreshSelectedTargetHealth } from '../commandIds';
import { runTask } from '../util/task';
import type { TaskFactory } from '../tasks/taskFactory';

vi.mock('../util/logger');
vi.mock('../util/task');

const mockRunTask = vi.mocked(runTask);

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
    let taskFactory: MockProxy<TaskFactory>;

    const target = 'user@topo.local';
    const task = new vscode.Task(
        { type: 'process' },
        vscode.TaskScope.Workspace,
        'Fix task',
        'topo',
    );
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
        new FixIssue(taskFactory, targetModel);

    const createHealthGroupItem = (
        targetHealthChecks: HealthCheck[],
    ): HealthCheckGroupTreeItem =>
        new HealthCheckGroupTreeItem(loaded(targetHealthChecks));

    beforeEach(() => {
        vi.clearAllMocks();
        taskFactory = mock<TaskFactory>();
        taskFactory.createProcessTask.mockReturnValue(task);
        targetModel = new TargetModel();
        targetModel.setSelected(target);
    });

    it('builds a fix task with the topo command name', () => {
        const command = healthChecks[1].fix?.command;
        if (!command) {
            throw new Error('Expected debugger health check to include a fix');
        }
        const createdTask = createFixIssueTask(
            taskFactory,
            target,
            ['Debugger'],
            command,
        );

        expect(taskFactory.createProcessTask).toHaveBeenCalledWith(
            `Fix Debugger on ${target}`,
            ['topo', 'install', 'debugger', '--target', target],
        );
        expect(createdTask).toBe(task);
    });

    it('runs a single issue fix directly', async () => {
        const fixIssue = createFixIssue();
        const healthCheckItem = new HealthCheckTreeItem(
            loaded(healthChecks[0]),
        );

        await fixIssue.fixIssueCommandHandler(healthCheckItem);

        expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
        expect(taskFactory.createProcessTask).toHaveBeenCalledWith(
            `Fix Container Engine on ${target}`,
            ['topo', 'install', 'container-engine', '--target', target],
        );
        expect(mockRunTask).toHaveBeenCalledWith(task);
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            refreshSelectedTargetHealth,
        );
    });

    it('fails a single issue fix without an executable command', async () => {
        const fixIssue = createFixIssue();
        const healthCheckItem = new HealthCheckTreeItem(
            loaded(healthChecks[2]),
        );

        await expect(
            fixIssue.fixIssueCommandHandler(healthCheckItem),
        ).rejects.toThrow('No executable fix found for the selected item');

        expect(mockRunTask).not.toHaveBeenCalled();
        expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith(
            refreshSelectedTargetHealth,
        );
    });

    it('refreshes after an issue fix task fails', async () => {
        mockRunTask.mockRejectedValueOnce(new Error('fix failed'));
        const fixIssue = createFixIssue();
        const healthCheckItem = new HealthCheckTreeItem(
            loaded(healthChecks[0]),
        );

        await fixIssue.fixIssueCommandHandler(healthCheckItem);

        expect(mockRunTask).toHaveBeenCalledOnce();
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            refreshSelectedTargetHealth,
        );
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

        expect(mockRunTask).not.toHaveBeenCalled();
        expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith(
            refreshSelectedTargetHealth,
        );
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
        expect(taskFactory.createProcessTask).toHaveBeenCalledWith(
            `Fix Container Engine on ${target}`,
            ['topo', 'install', 'container-engine', '--target', target],
        );
        expect(mockRunTask).toHaveBeenCalledWith(task);
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            refreshSelectedTargetHealth,
        );
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
        expect(taskFactory.createProcessTask).toHaveBeenCalledWith(
            `Fix Debugger on ${target}`,
            ['topo', 'install', 'debugger', '--target', target],
        );
        expect(mockRunTask).toHaveBeenCalledWith(task);
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

        expect(taskFactory.createProcessTask).toHaveBeenNthCalledWith(
            1,
            `Fix Container Engine on ${target}`,
            ['topo', 'install', 'container-engine', '--target', target],
        );
        expect(taskFactory.createProcessTask).toHaveBeenNthCalledWith(
            2,
            `Fix Debugger on ${target}`,
            ['topo', 'install', 'debugger', '--target', target],
        );
        expect(mockRunTask).toHaveBeenCalledTimes(2);
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            refreshSelectedTargetHealth,
        );
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

        expect(taskFactory.createProcessTask).toHaveBeenCalledWith(
            `Fix Remoteproc Runtime, Remoteproc Shim on ${target}`,
            ['topo', 'install', 'remoteproc', '--target', target],
        );
        expect(mockRunTask).toHaveBeenCalledOnce();
    });

    it('refreshes when target issue selection is cancelled', async () => {
        const fixIssue = createFixIssue();
        const healthGroupItem = createHealthGroupItem(healthChecks);
        mockSelectedQuickPickItems([]);

        await fixIssue.fixIssueCommandHandler(healthGroupItem);

        expect(mockRunTask).not.toHaveBeenCalled();
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            refreshSelectedTargetHealth,
        );
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
        expect(mockRunTask).not.toHaveBeenCalled();
        expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith(
            refreshSelectedTargetHealth,
        );
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
