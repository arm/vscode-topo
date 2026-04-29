import * as vscode from 'vscode';
import { mock } from 'jest-mock-extended';
import { InstallDependency } from './installDependency';
import { TargetStore } from '../workloadPlacement/targetStore';
import { TargetTreeDependencyItem } from '../workloadPlacement/targetTreeDependencyItem';
import { HealthCheckResult } from '../topoCliSchema';
import { mutable } from '../util/mutable';
import { ContainersManager } from '../workloadPlacement/containersManager';

jest.mock('../util/logger');

const getCommandHandler = () => {
    const handler = jest
        .mocked(vscode.commands.registerCommand)
        .mock.calls.find(
            ([command]) =>
                command === InstallDependency.installDependencyCommand,
        )?.[1] as ((treeNode: unknown) => Promise<void>) | undefined;

    if (!handler) {
        throw new Error('No install dependency handler registered');
    }

    return handler;
};

const waitImmediate = () =>
    new Promise<void>((resolve) => setTimeout(() => resolve(), 0));

const loadedHealth: HealthCheckResult = {
    host: { dependencies: [] },
    target: {
        isLocalhost: false,
        dependencies: [
            {
                name: 'Container Engine',
                status: 'ok',
                value: 'docker',
            },
        ],
        connectivity: { name: 'Connected', status: 'ok', value: '' },
        subsystemDriver: {
            name: 'Subsystem Driver (remoteproc)',
            status: 'ok',
            value: 'driver-x',
        },
    },
};

describe('InstallDependency', () => {
    const targetStore = mock<TargetStore>();
    const containersManager = mock<ContainersManager>();
    const target = 'user@topo.local';
    const onDidEndTaskProcessEmitter =
        new vscode.EventEmitter<vscode.TaskProcessEndEvent>();

    beforeEach(() => {
        targetStore.getSelectedTarget.mockResolvedValue(target);
        containersManager.getTargetState.mockResolvedValue({
            health: loadedHealth.target,
            target,
        });

        mutable(vscode.tasks).onDidEndTaskProcess =
            onDidEndTaskProcessEmitter.event;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('registers install dependency command', async () => {
        const installDependency = new InstallDependency(
            targetStore,
            containersManager,
        );

        await installDependency.activate();

        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            InstallDependency.installDependencyCommand,
            expect.any(Function),
        );
    });

    it('runs install task for dependency with `topo install` fix', async () => {
        const taskExec: vscode.TaskExecution = {
            task: {} as vscode.Task,
            terminate: jest.fn(),
        };
        jest.mocked(vscode.tasks.executeTask).mockResolvedValue(taskExec);
        const installDependency = new InstallDependency(
            targetStore,
            containersManager,
        );
        const dependencyItem = new TargetTreeDependencyItem({
            name: 'Remoteproc Runtime',
            status: 'error',
            value: 'missing',
            fix: 'run `topo install remoteproc-runtime`',
        });

        await installDependency.activate();

        const handler = getCommandHandler()(dependencyItem);
        await waitImmediate();
        onDidEndTaskProcessEmitter.fire({
            execution: taskExec,
            exitCode: 0,
        });
        await handler;

        expect(vscode.ShellExecution).toHaveBeenCalledWith('topo', [
            'install',
            'remoteproc-runtime',
            '--target',
            target,
        ]);
        expect(vscode.tasks.executeTask).toHaveBeenCalled();
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
            `remoteproc-runtime was installed on target ${target}`,
        );
    });

    it('does nothing for a healthy dependency', async () => {
        const installDependency = new InstallDependency(
            targetStore,
            containersManager,
        );
        const dependencyItem = new TargetTreeDependencyItem({
            name: 'Remoteproc Runtime',
            status: 'ok',
            value: 'installed',
        });

        await installDependency.activate();
        await getCommandHandler()(dependencyItem);

        expect(vscode.tasks.executeTask).not.toHaveBeenCalled();
    });

    it('shows one notification for missing installable dependencies', async () => {
        containersManager.getTargetState.mockResolvedValue({
            health: {
                ...loadedHealth.target,
                dependencies: [
                    ...loadedHealth.target.dependencies,
                    {
                        name: 'Remoteproc Runtime',
                        status: 'error',
                        value: 'missing',
                        fix: 'run `topo install remoteproc-runtime`',
                    },
                    {
                        name: 'Debugger',
                        status: 'error',
                        value: 'missing',
                        fix: 'run `topo install debugger`',
                    },
                ],
            },
            target,
        });
        const installDependency = new InstallDependency(
            targetStore,
            containersManager,
        );

        await installDependency.activate();

        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            `${target} has missing or unhealthy dependencies: remoteproc-runtime, debugger`,
            { title: 'Install missing dependencies' },
        );
    });
});
