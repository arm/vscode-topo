import { TARGET_HOST_RUNTIME } from '../manifest';
import * as vscode from 'vscode';
import { ContainerStop } from './containerStop';
import { ContainerItem } from '../util/types';
import { TargetContainerTreeItem } from '../targetTreeView/targetContainerTreeItem';
import { WrappedError } from '../errors/wrappedError';
import { mock, MockProxy } from 'jest-mock-extended';
import { ContainerCommands } from '../target/containerCommands';
import { refreshTargetContainersCommand } from '../refreshCommands';

describe('ContainerStop', () => {
    let context: MockProxy<vscode.ExtensionContext>;
    let showErrorMessageSpy: jest.SpyInstance;
    let commandHandler:
        | { command: string; callback: (...args: unknown[]) => void }
        | undefined;
    const registerCommandMock = jest.mocked(vscode.commands.registerCommand);
    const target = 'user@topo.local';
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
        target,
    };
    const treeItem = new TargetContainerTreeItem(container);

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
        const containerCommands = mock<ContainerCommands>();
        const containerStop = new ContainerStop(context, containerCommands);
        await containerStop.activate();

        // Simulate command handler
        await vscode.commands.executeCommand(
            ContainerStop.stopContainerCommand,
            treeItem,
        );

        expect(containerCommands.stopContainer).toHaveBeenCalledWith(
            'abc123',
            target,
        );
    });

    it('refreshes target containers after stopping a container', async () => {
        const containerCommands = mock<ContainerCommands>();
        const containerStop = new ContainerStop(context, containerCommands);
        await containerStop.activate();

        await vscode.commands.executeCommand(
            ContainerStop.stopContainerCommand,
            treeItem,
        );

        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            refreshTargetContainersCommand,
        );
    });

    it('shows error message and refreshes UI if stopContainer throws a WrappedError', async () => {
        const containerCommands = mock<ContainerCommands>();
        containerCommands.stopContainer.mockRejectedValue(
            new WrappedError('DOCKER', 'fail'),
        );
        const containerStop = new ContainerStop(context, containerCommands);
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
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            refreshTargetContainersCommand,
        );
    });

    it('re-throw generic error errors from stopContainer', async () => {
        const containerCommands = mock<ContainerCommands>();
        containerCommands.stopContainer.mockRejectedValue(
            new Error('generic error'),
        );
        const containerStop = new ContainerStop(context, containerCommands);
        await containerStop.activate();

        await expect(
            vscode.commands.executeCommand(
                ContainerStop.stopContainerCommand,
                treeItem,
            ),
        ).rejects.toThrow('generic error');
    });
});
