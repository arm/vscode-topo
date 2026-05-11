import * as vscode from 'vscode';
import { mock } from 'jest-mock-extended';
import { InstallDependency } from './installDependency';
import { TargetStore } from '../target/targetStore';
import { HealthCheckDependencyTreeItem } from '../treeItems/healthCheckDependencyTreeItem';
import { HealthCheckResult } from '../topoCliSchema';
import { ContainersManager } from '../target/containersManager';
import { executeTask } from '../util/executeTask';
import { WrappedError } from '../errors/wrappedError';

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
        jest.clearAllMocks();
        targetStore.getSelectedTarget.mockReset();
        containersManager.getTargetState.mockReset();
        targetStore.getSelectedTarget.mockResolvedValue(target);
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
        const dependencyItem = new HealthCheckDependencyTreeItem({
            name: 'Remoteproc Runtime',
            status: 'ok',
            value: 'installed',
        });

        await installDependency.activate();
        await getCommandHandler()(dependencyItem);

        expect(executeTaskMock).not.toHaveBeenCalled();
    });

    it('shows an error when no target is available for install dependency', async () => {
        targetStore.getSelectedTarget.mockResolvedValue(undefined);
        const installDependency = new InstallDependency(
            targetStore,
            containersManager,
        );
        const dependencyItem = new HealthCheckDependencyTreeItem({
            name: 'Remoteproc Runtime',
            status: 'error',
            value: 'missing',
            fix: 'run `topo install remoteproc-runtime`',
        });

        await installDependency.activate();
        await getCommandHandler()(dependencyItem);

        expect(executeTaskMock).not.toHaveBeenCalled();
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Failed to install dependency. No selected target found',
        );
    });

    it('shows an error when selected target lookup fails with a TARGET error', async () => {
        targetStore.getSelectedTarget
            .mockResolvedValueOnce(target)
            .mockRejectedValueOnce(
                new WrappedError('TARGET', 'target store failed'),
            );
        const installDependency = new InstallDependency(
            targetStore,
            containersManager,
        );
        const dependencyItem = new HealthCheckDependencyTreeItem({
            name: 'Remoteproc Runtime',
            status: 'error',
            value: 'missing',
            fix: 'run `topo install remoteproc-runtime`',
        });

        await installDependency.activate();
        await getCommandHandler()(dependencyItem);

        expect(executeTaskMock).not.toHaveBeenCalled();
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Failed to install dependency. target store failed',
        );
    });

    it('rethrows non-TARGET errors from selected target lookup', async () => {
        targetStore.getSelectedTarget
            .mockResolvedValueOnce(target)
            .mockRejectedValueOnce(new Error('target lookup failed'));
        const installDependency = new InstallDependency(
            targetStore,
            containersManager,
        );
        const dependencyItem = new HealthCheckDependencyTreeItem({
            name: 'Remoteproc Runtime',
            status: 'error',
            value: 'missing',
            fix: 'run `topo install remoteproc-runtime`',
        });

        await installDependency.activate();

        await expect(getCommandHandler()(dependencyItem)).rejects.toThrow(
            'target lookup failed',
        );
        expect(executeTaskMock).not.toHaveBeenCalled();
        expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
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
            status: 'connected',
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
