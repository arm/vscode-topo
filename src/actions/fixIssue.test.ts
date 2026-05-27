import * as vscode from 'vscode';
import { mock } from 'jest-mock-extended';
import { FixIssue } from './fixIssue';
import { TargetStore } from '../target/targetStore';
import { HealthCheckDependencyTreeItem } from '../treeItems/healthCheckDependencyTreeItem';
import { HealthCheckResult } from '../topoCliSchema';
import { ContainersManager } from '../target/containersManager';
import { executeTask } from '../util/executeTask';
import { executeCommand } from '../util/test/executeCommand';

jest.mock('../util/logger');
jest.mock('../util/executeTask');

const executeTaskMock = jest.mocked(executeTask);

const waitImmediate = async () => {
    await Promise.resolve();
    await Promise.resolve();
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

describe('FixIssue', () => {
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

    it('registers fix issue command', async () => {
        const fixIssue = new FixIssue(targetStore, containersManager);

        fixIssue.activate();

        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            FixIssue.fixIssueCommand,
            expect.any(Function),
        );
    });

    it('runs fix task for dependency with executable fix', async () => {
        const fixIssue = new FixIssue(targetStore, containersManager);
        const dependencyItem = new HealthCheckDependencyTreeItem({
            name: 'Remoteproc Runtime',
            status: 'error',
            value: 'missing',
            fix: {
                description: 'Install the remoteproc runtime',
                command: `topo install remoteproc-runtime --target ${target}`,
            },
        });

        fixIssue.activate();

        await executeCommand(FixIssue.fixIssueCommand, dependencyItem);

        expect(executeTaskMock).toHaveBeenCalledWith(
            `Fix Remoteproc Runtime on ${target}`,
            ['topo', 'install', 'remoteproc-runtime', '--target', target],
        );
    });

    it('does nothing for a healthy dependency', async () => {
        const fixIssue = new FixIssue(targetStore, containersManager);
        const dependencyItem = new HealthCheckDependencyTreeItem({
            name: 'Remoteproc Runtime',
            status: 'ok',
            value: 'installed',
        });

        fixIssue.activate();
        await executeCommand(FixIssue.fixIssueCommand, dependencyItem);

        expect(executeTaskMock).not.toHaveBeenCalled();
    });

    it('shows one prompt for fixable dependencies', async () => {
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
        const fixIssue = new FixIssue(targetStore, containersManager);

        fixIssue.activate();
        await waitImmediate();

        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            `${target} has missing or unhealthy dependencies: Remoteproc Runtime, Debugger`,
            { title: 'Fix' },
        );
    });

    it('lists every missing dependency when multiple dependencies share a fix command', async () => {
        jest.mocked(vscode.window.showWarningMessage).mockResolvedValue({
            title: 'Fix',
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
        const fixIssue = new FixIssue(targetStore, containersManager);

        await fixIssue.activate();

        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            `${target} has missing or unhealthy dependencies: Remoteproc Runtime, Remoteproc Shim`,
            { title: 'Fix' },
        );
        expect(executeTaskMock).toHaveBeenCalledTimes(1);
        expect(executeTaskMock).toHaveBeenCalledWith(
            `Fix Remoteproc Runtime, Remoteproc Shim on ${target}`,
            ['topo', 'install', 'remoteproc', '--target', target],
        );
    });
});
