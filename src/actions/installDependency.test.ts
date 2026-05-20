import * as vscode from 'vscode';
import { mock } from 'jest-mock-extended';
import { InstallDependency } from './installDependency';
import { TargetStore } from '../target/targetStore';
import { HealthCheckDependencyTreeItem } from '../treeItems/healthCheckDependencyTreeItem';
import { HealthCheckResult } from '../topoCliSchema';
import { ContainersManager } from '../target/containersManager';
import { executeTask } from '../util/executeTask';

jest.mock('../util/logger');
jest.mock('../util/executeTask');

const executeTaskMock = jest.mocked(executeTask);

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

    beforeEach(() => {
        targetStore.getSelectedTarget.mockReturnValue(target);
        containersManager.getTargetState.mockResolvedValue({
            health: loadedHealth.target,
            status: 'connected',
        });
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
        const installDependency = new InstallDependency(
            targetStore,
            containersManager,
        );
        const dependencyItem = new HealthCheckDependencyTreeItem({
            name: 'Remoteproc Runtime',
            status: 'error',
            value: 'missing',
            fix: {
                description: 'Install the remoteproc runtime',
                command: `topo install remoteproc-runtime --target ${target}`,
            },
        });

        await installDependency.activate();

        await getCommandHandler()(dependencyItem);

        expect(executeTaskMock).toHaveBeenCalledWith(
            `Install Remoteproc Runtime on ${target}`,
            ['topo', 'install', 'remoteproc-runtime', '--target', target],
        );
    });

    it('does nothing for a healthy dependency', async () => {
        const installDependency = new InstallDependency(
            targetStore,
            containersManager,
        );
        const dependencyItem = new HealthCheckDependencyTreeItem({
            name: 'Remoteproc Runtime',
            status: 'ok',
            value: 'installed',
        });

        await installDependency.activate();
        await getCommandHandler()(dependencyItem);

        expect(executeTaskMock).not.toHaveBeenCalled();
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
                        fix: {
                            description: 'Install the remoteproc runtime',
                            command: `topo install remoteproc-runtime --target ${target}`,
                        },
                    },
                    {
                        name: 'Debugger',
                        status: 'error',
                        value: 'missing',
                        fix: {
                            description: 'Install the debugger',
                            command: 'topo install debugger',
                        },
                    },
                ],
            },
            status: 'connected',
        });
        const installDependency = new InstallDependency(
            targetStore,
            containersManager,
        );

        await installDependency.activate();

        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            `${target} has missing or unhealthy dependencies: Remoteproc Runtime, Debugger`,
            { title: 'Install missing dependencies' },
        );
    });

    it('lists every missing dependency when multiple dependencies share a fix command', async () => {
        jest.mocked(vscode.window.showWarningMessage).mockResolvedValue({
            title: 'Install missing dependencies',
        });
        containersManager.getTargetState.mockResolvedValue({
            health: {
                ...loadedHealth.target,
                dependencies: [
                    {
                        name: 'Remoteproc Runtime',
                        status: 'error',
                        value: 'missing',
                        fix: {
                            description: 'Install the remoteproc components',
                            command: `topo install remoteproc --target ${target}`,
                        },
                    },
                    {
                        name: 'Remoteproc Shim',
                        status: 'error',
                        value: 'missing',
                        fix: {
                            description: 'Install the remoteproc components',
                            command: `topo install remoteproc --target ${target}`,
                        },
                    },
                ],
            },
            status: 'connected',
        });
        const installDependency = new InstallDependency(
            targetStore,
            containersManager,
        );

        await installDependency.activate();

        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            `${target} has missing or unhealthy dependencies: Remoteproc Runtime, Remoteproc Shim`,
            { title: 'Install missing dependencies' },
        );
        expect(executeTaskMock).toHaveBeenCalledTimes(1);
        expect(executeTaskMock).toHaveBeenCalledWith(
            `Install Remoteproc Runtime, Remoteproc Shim on ${target}`,
            ['topo', 'install', 'remoteproc', '--target', target],
        );
    });
});
