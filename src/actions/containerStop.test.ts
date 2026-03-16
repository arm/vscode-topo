import { TARGET_HOST_RUNTIME } from '../manifest';
import * as vscode from 'vscode';
import { ContainerStop } from './containerStop';
import { ContainerItem, TargetItem } from '../util/types';
import { TargetTreeContainerItem } from '../workloadPlacement/targetTreeContainerItem';
import { TopoError } from '../errors/topoError';
import { mock, MockProxy } from 'jest-mock-extended';
import { ContainersManager } from '../workloadPlacement/containersManager';

describe('ContainerStop', () => {
    let context: MockProxy<vscode.ExtensionContext>;
    let showErrorMessageSpy: jest.SpyInstance;
    let commandHandler:
        | { command: string; callback: (...args: unknown[]) => void }
        | undefined;
    const registerCommandMock = jest.mocked(vscode.commands.registerCommand);
    const target: TargetItem = {
        id: 'topo',
        ssh: 'user@topo.local',
        user: 'user',
        host: 'topo.local',
        targetDescription: {
            hostProcessor: [],
            remoteprocCPU: [],
        },
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
        const containersManager: MockProxy<ContainersManager> =
            mock<ContainersManager>();
        const containerStop = new ContainerStop(context, containersManager);
        await containerStop.activate();

        // Simulate command handler
        await vscode.commands.executeCommand(
            ContainerStop.stopContainerCommand,
            treeItem,
        );

        expect(containersManager.stopContainer).toHaveBeenCalledWith('abc123');
    });

    it('shows error message if stopContainer throws a TopoError', async () => {
        const containersManager: MockProxy<ContainersManager> =
            mock<ContainersManager>();
        containersManager.stopContainer.mockRejectedValue(
            new TopoError('DOCKER', 'fail'),
        );
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
        const containersManager: MockProxy<ContainersManager> =
            mock<ContainersManager>();
        containersManager.stopContainer.mockRejectedValue(
            new Error('non-TopoError'),
        );
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
