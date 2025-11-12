import { BOARD_HOST_RUNTIME } from '../manifest';
import { ContainerTreeItem } from '../workloadPlacement/containerTreeItems';
import * as vscode from 'vscode';
import { ContainerStart } from './containerStart';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('ContainerStart', () => {
    const context: any = { subscriptions: [] };
    let showErrorMessageSpy: jest.SpyInstance;
    let commandHandler: { command: string; callback: (...args: any[]) => void } | undefined;
    const registerCommandMock = vscode.commands.registerCommand as jest.Mock;

    beforeEach(() => {
        showErrorMessageSpy = jest.spyOn(vscode.window, 'showErrorMessage').mockImplementation(jest.fn());
        registerCommandMock.mockImplementation((command, callback) => {
            if (command !== ContainerStart.startContainerCommandType) {
                throw Error('Unexpected command registration');
            }
            commandHandler = { command, callback };
            return { dispose: jest.fn() };
        });
        (vscode.commands.executeCommand as jest.Mock).mockImplementation((command, ...args) => {
            if (command === ContainerStart.startContainerCommandType && commandHandler) {
                return commandHandler.callback(...args);
            }
            return Promise.resolve();
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('calls startContainer and shows info message on success', async () => {
        const container: ContainerTreeItem = {
            id: 'abc123',
            name: 'my-container',
            image: 'nginx',
            state: 'exited',
            status: 'Up',
            labels: '',
            runningFor: '',
            runtime: BOARD_HOST_RUNTIME,
            createdAt: '',
            subsystem: 'Host',
            ports: [],
            cpuUsage: '0.0%',
            memUsage: '0B / 1GiB',
        };
        const startContainerSpy = jest.fn(async () => undefined);
        const containersManager = {
            startContainer: startContainerSpy,
        };
        const containerStart = new ContainerStart(context, containersManager);
        await containerStart.activate();

        // Simulate command handler
        await vscode.commands.executeCommand(ContainerStart.startContainerCommandType, container);

        expect(startContainerSpy).toHaveBeenCalledWith('abc123');
    });

    it('shows error message if startContainer throws', async () => {
        const containersManager = {
            startContainer: async () => { throw new Error('fail'); },
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
        };
        const containerStart = new ContainerStart(context, containersManager);
        await containerStart.activate();

        await vscode.commands.executeCommand(ContainerStart.startContainerCommandType, container);

        expect(showErrorMessageSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to start service.'));
    });
});
