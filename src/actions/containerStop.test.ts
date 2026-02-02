import { BOARD_HOST_RUNTIME } from '../manifest';
import * as vscode from 'vscode';
import { ContainerStop } from './containerStop';
import { Target } from '../workloadPlacement/target';
import { ContainerItem } from '../workloadPlacement/containersManager';
import { TargetTreeContainerItem } from '../workloadPlacement/targetTreeContainerItem';
import { TopoError } from '../errors/topoError';

describe('ContainerStop', () => {
    const context: Pick<vscode.ExtensionContext, 'subscriptions'> = {
        subscriptions: [],
    };
    let showErrorMessageSpy: jest.SpyInstance;
    let commandHandler:
        | { command: string; callback: (...args: unknown[]) => void }
        | undefined;
    const registerCommandMock = jest.mocked(vscode.commands.registerCommand);
    const target = new Target('topo', 'user@topo.local');
    const container: ContainerItem = {
        id: 'abc123',
        name: 'my-container',
        image: 'nginx',
        state: 'running',
        status: 'Up',
        labels: '',
        runningFor: '',
        runtime: BOARD_HOST_RUNTIME,
        createdAt: '',
        ports: [],
        cpuUsage: '0.0%',
        memUsage: '0B / 1GiB',
        target,
    };
    const treeItem = new TargetTreeContainerItem(container);

    beforeEach(() => {
        commandHandler = undefined;
        showErrorMessageSpy = jest
            .spyOn(vscode.window, 'showErrorMessage')
            .mockImplementation(jest.fn());
        registerCommandMock.mockImplementation((command, callback) => {
            if (command !== ContainerStop.stopContainerCommand) {
                throw Error('Unexpected command registration');
            }
            commandHandler = { command, callback };
            return { dispose: jest.fn() };
        });
        jest.mocked(vscode.commands.executeCommand).mockImplementation(
            async (command, ...args) => {
                if (
                    command === ContainerStop.stopContainerCommand &&
                    commandHandler
                ) {
                    return commandHandler.callback(...args);
                }
                return Promise.resolve();
            },
        );
    });
    it('calls stopContainer and shows info message on success', async () => {
        const stopContainerSpy = jest.fn(async () => undefined);
        const containersManager = {
            stopContainer: stopContainerSpy,
        };
        const containerStop = new ContainerStop(context, containersManager);
        await containerStop.activate();

        // Simulate command handler
        await vscode.commands.executeCommand(
            ContainerStop.stopContainerCommand,
            treeItem,
        );

        expect(stopContainerSpy).toHaveBeenCalledWith('abc123');
    });

    it('shows error message if stopContainer throws a TopoError', async () => {
        const containersManager = {
            stopContainer: async () => {
                throw new TopoError('DOCKER', 'fail');
            },
        };
        const containerStop = new ContainerStop(context, containersManager);
        await containerStop.activate();

        await vscode.commands.executeCommand(
            ContainerStop.stopContainerCommand,
            treeItem,
        );

        expect(showErrorMessageSpy).toHaveBeenCalledWith(
            expect.stringContaining(
                'Failed to stop the container abc123. fail',
            ),
        );
    });

    it('re-throw non-TopoError errors from stopContainer', async () => {
        const containersManager = {
            stopContainer: async () => {
                throw new Error('non-TopoError');
            },
        };
        const containerStop = new ContainerStop(context, containersManager);
        await containerStop.activate();

        await expect(
            vscode.commands.executeCommand(
                ContainerStop.stopContainerCommand,
                treeItem,
            ),
        ).rejects.toThrow('non-TopoError');
    });
});
