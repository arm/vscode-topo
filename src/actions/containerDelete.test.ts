import { TARGET_HOST_RUNTIME } from '../manifest';
import * as vscode from 'vscode';
import { ContainerDelete } from './containerDelete';
import { ContainerItem, TargetItem } from '../util/types';
import { TargetTreeContainerItem } from '../workloadPlacement/targetTreeContainerItem';
import { TopoError } from '../errors/topoError';
import { mock, MockProxy } from 'jest-mock-extended';
import { ContainersManager } from '../workloadPlacement/containersManager';

describe('ContainerDelete', () => {
    let context: MockProxy<vscode.ExtensionContext>;
    let showErrorMessageSpy: jest.SpyInstance;
    let commandHandler:
        | { command: string; callback: (...args: unknown[]) => void }
        | undefined;
    const registerCommandMock = jest.mocked(vscode.commands.registerCommand);

    const target: TargetItem = {
        ssh: 'user@topo.local',
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
            if (command !== ContainerDelete.deleteContainerCommand) {
                throw Error('Unexpected command registration');
            }
            commandHandler = { command, callback };
            return { dispose: jest.fn() };
        });

        jest.mocked(vscode.commands.executeCommand).mockImplementation(
            async (command, ...args) => {
                if (
                    command === ContainerDelete.deleteContainerCommand &&
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

    it('calls deleteContainer on success', async () => {
        const containersManager: MockProxy<ContainersManager> =
            mock<ContainersManager>();
        const containerDelete = new ContainerDelete(context, containersManager);
        containerDelete.activate();

        await vscode.commands.executeCommand(
            ContainerDelete.deleteContainerCommand,
            treeItem,
        );

        expect(containersManager.deleteContainer).toHaveBeenCalledWith(
            'abc123',
        );
    });

    it('shows error message if deleteContainer throws a TopoError', async () => {
        const containersManager: MockProxy<ContainersManager> =
            mock<ContainersManager>();
        containersManager.deleteContainer.mockRejectedValue(
            new TopoError('DOCKER', 'fail'),
        );
        const containerDelete = new ContainerDelete(context, containersManager);
        containerDelete.activate();

        await vscode.commands.executeCommand(
            ContainerDelete.deleteContainerCommand,
            treeItem,
        );

        expect(showErrorMessageSpy).toHaveBeenCalledWith(
            expect.stringContaining(
                'Failed to delete the container abc123. fail',
            ),
        );
    });

    it('re-throws non-TopoError errors from deleteContainer', async () => {
        const containersManager: MockProxy<ContainersManager> =
            mock<ContainersManager>();
        containersManager.deleteContainer.mockRejectedValue(
            new Error('non-TopoError'),
        );
        const containerDelete = new ContainerDelete(context, containersManager);
        containerDelete.activate();

        await expect(
            vscode.commands.executeCommand(
                ContainerDelete.deleteContainerCommand,
                treeItem,
            ),
        ).rejects.toThrow('non-TopoError');
    });
});
