import { TARGET_HOST_RUNTIME } from '../manifest';
import * as vscode from 'vscode';
import { ContainerStart } from './containerStart';
import { TargetTreeContainerItem } from '../workloadPlacement/targetTreeContainerItem';
import { WrappedError } from '../errors/wrappedError';
import { mock, MockProxy } from 'jest-mock-extended';
import { ContainersManager } from '../workloadPlacement/containersManager';
import { ContainerItem, TargetItem } from '../util/types';

describe('ContainerStart', () => {
    let context: MockProxy<vscode.ExtensionContext>;
    let showErrorMessageSpy: jest.SpyInstance;
    let commandHandler:
        | { command: string; callback: (...args: unknown[]) => void }
        | undefined;
    const registerCommandMock = jest.mocked(vscode.commands.registerCommand);
    const target: TargetItem = {
        ssh: 'user@topo.local',
        host: 'topo.local',
    };
    const container: ContainerItem = {
        id: 'abc123',
        name: 'my-container',
        image: 'nginx',
        state: 'running',
        status: 'Up',
        labels: '',
        runningFor: '',
        runtime: TARGET_HOST_RUNTIME,
        annotations: {},
        createdAt: '',
        ports: {},
        cpuUsage: '0.0%',
        memUsage: '0B / 1GiB',
        target,
    };
    const treeItem = new TargetTreeContainerItem(container);

    beforeEach(() => {
        context = mock<vscode.ExtensionContext>({ subscriptions: [] });
        commandHandler = undefined;
        showErrorMessageSpy = jest
            .spyOn(vscode.window, 'showErrorMessage')
            .mockImplementation(jest.fn());
        registerCommandMock.mockImplementation((command, callback) => {
            if (command !== ContainerStart.startContainerCommand) {
                throw Error('Unexpected command registration');
            }
            commandHandler = { command, callback };
            return { dispose: jest.fn() };
        });
        jest.mocked(vscode.commands.executeCommand).mockImplementation(
            async (command, ...args) => {
                if (
                    command === ContainerStart.startContainerCommand &&
                    commandHandler
                ) {
                    return commandHandler.callback(...args);
                }
                return Promise.resolve();
            },
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('calls startContainer and shows info message on success', async () => {
        const containersManager: MockProxy<ContainersManager> =
            mock<ContainersManager>();
        const containerStart = new ContainerStart(context, containersManager);
        containerStart.activate();

        // Simulate command handler
        await vscode.commands.executeCommand(
            ContainerStart.startContainerCommand,
            treeItem,
        );

        expect(containersManager.startContainer).toHaveBeenCalledWith('abc123');
    });

    it('shows error message if startContainer throws a WrappedError', async () => {
        const containersManager: MockProxy<ContainersManager> =
            mock<ContainersManager>();
        containersManager.startContainer.mockRejectedValue(
            new WrappedError('DOCKER', 'fail'),
        );
        const containerStart = new ContainerStart(context, containersManager);
        containerStart.activate();

        await vscode.commands.executeCommand(
            ContainerStart.startContainerCommand,
            treeItem,
        );

        expect(showErrorMessageSpy).toHaveBeenCalledWith(
            expect.stringContaining(
                'Failed to start the container abc123. fail',
            ),
        );
    });

    it('re-throws generic error errors from startContainer', async () => {
        const containersManager: MockProxy<ContainersManager> =
            mock<ContainersManager>();
        containersManager.startContainer.mockRejectedValue(
            new Error('generic error'),
        );
        const containerStart = new ContainerStart(context, containersManager);
        containerStart.activate();

        await expect(
            vscode.commands.executeCommand(
                ContainerStart.startContainerCommand,
                treeItem,
            ),
        ).rejects.toThrow('generic error');
    });
});
