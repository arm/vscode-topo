import { BOARD_HOST_RUNTIME } from '../manifest';
import * as vscode from 'vscode';
import { ContainerDelete } from './containerDelete';
import { Target } from '../workloadPlacement/target';
import { ContainerItem } from '../workloadPlacement/containersManager';
import { TargetTreeContainerItem } from '../workloadPlacement/targetTreeContainerItem';
import { TopoError } from '../errors/topoError';

describe('ContainerDelete', () => {
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
        const deleteContainerSpy = jest.fn(async () => undefined);
        const containersManager = {
            deleteContainer: deleteContainerSpy,
        };
        const containerDelete = new ContainerDelete(context, containersManager);
        containerDelete.activate();

        await vscode.commands.executeCommand(
            ContainerDelete.deleteContainerCommand,
            treeItem,
        );

        expect(deleteContainerSpy).toHaveBeenCalledWith('abc123');
    });

    it('shows error message if deleteContainer throws a TopoError', async () => {
        const containersManager = {
            deleteContainer: async () => {
                throw new TopoError('DOCKER', 'fail');
            },
        };
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
        const containersManager = {
            deleteContainer: async () => {
                throw new Error('non-TopoError');
            },
        };
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
