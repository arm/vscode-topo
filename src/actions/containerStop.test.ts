import { BOARD_HOST_RUNTIME } from '../manifest';
import { ContainerTreeItem } from '../workloadPlacement/containerTreeItems';
import * as vscode from 'vscode';
import { ContainerStop } from './containerStop';
import { Target } from '../workloadPlacement/target';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('ContainerStop', () => {
    const context: any = { subscriptions: [] };
    let showErrorMessageSpy: jest.SpyInstance;
    let commandHandler: { command: string; callback: (...args: any[]) => void } | undefined;
    const registerCommandMock = vscode.commands.registerCommand as jest.Mock;
    const target = new Target(
        'topo',
        'user@topo.local',
    );

    beforeEach(() => {
        showErrorMessageSpy = jest.spyOn(vscode.window, 'showErrorMessage').mockImplementation(jest.fn());
        registerCommandMock.mockImplementation((command, callback) => {
            if (command !== ContainerStop.stopContainerCommandType) {
                throw Error('Unexpected command registration');
            }
            commandHandler = { command, callback };
            return { dispose: jest.fn() };
        });
        (vscode.commands.executeCommand as jest.Mock).mockImplementation((command, ...args) => {
            if (command === ContainerStop.stopContainerCommandType && commandHandler) {
                return commandHandler.callback(...args);
            }
            return Promise.resolve();
        });
    });
    it('calls stopContainer and shows info message on success', async () => {
        const container: ContainerTreeItem = {
            id: 'abc123',
            name: 'my-container',
            image: 'nginx',
            state: 'running',
            status: 'Up',
            labels: '',
            runningFor: '',
            runtime: BOARD_HOST_RUNTIME,
            createdAt: '',
            subsystem: 'Host',
            ports: [],
            cpuUsage: '0.0%',
            memUsage: '0B / 1GiB',
            target,
        };
        const stopContainerSpy = jest.fn(async () => undefined);
        const containersManager = {
            stopContainer: stopContainerSpy,
        };
        const containerStop = new ContainerStop(context, containersManager);
        await containerStop.activate();

        // Simulate command handler
        await vscode.commands.executeCommand(ContainerStop.stopContainerCommandType, container);

        expect(stopContainerSpy).toHaveBeenCalledWith('abc123');
    });

    it('shows error message if stopContainer throws', async () => {
        const containersManager = {
            stopContainer: async () => { throw new Error('fail'); },
        };
        const container: ContainerTreeItem = {
            id: 'abc123',
            name: 'my-container',
            image: 'nginx',
            state: 'running',
            status: 'Up',
            labels: '',
            runningFor: '',
            runtime: BOARD_HOST_RUNTIME,
            createdAt: '',
            subsystem: 'Host',
            ports: [],
            cpuUsage: '0.0%',
            memUsage: '0B / 1GiB',
            target,
        };
        const containerStop = new ContainerStop(context, containersManager);
        await containerStop.activate();

        await vscode.commands.executeCommand(ContainerStop.stopContainerCommandType, container);

        expect(showErrorMessageSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to stop service.'));
    });
});
