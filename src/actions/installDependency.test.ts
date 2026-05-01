import * as vscode from 'vscode';
import { mock } from 'jest-mock-extended';
import { InstallDependency } from './installDependency';
import { TargetStore } from '../workloadPlacement/targetStore';
import { TargetTreeDependencyItem } from '../workloadPlacement/targetTreeDependencyItem';
import { HealthCheckResult } from '../topoCliSchema';
import { ContainersManager } from '../workloadPlacement/containersManager';
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
        targetStore.getSelectedTarget.mockResolvedValue(target);
        containersManager.getTargetState.mockResolvedValue({
            health: loadedHealth.target,
            target,
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
        const dependencyItem = new TargetTreeDependencyItem({
            name: 'Remoteproc Runtime',
            status: 'error',
            value: 'missing',
            fix: 'run `topo install remoteproc-runtime`',
        });

        await installDependency.activate();

        await getCommandHandler()(dependencyItem);

        expect(executeTaskMock).toHaveBeenCalledWith(
            `Install remoteproc-runtime on ${target}`,
            ['topo', 'install', 'remoteproc-runtime', '--target', target],
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
