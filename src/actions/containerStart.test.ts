import { BOARD_HOST_RUNTIME } from '../manifest';
import * as vscode from 'vscode';
import { ContainerStart } from './containerStart';
import { Target } from '../workloadPlacement/target';
import { ContainerItem } from '../workloadPlacement/containersManager';
import { TargetTreeContainerItem } from '../workloadPlacement/targetTreeContainerItem';

describe('ContainerStart', () => {
    const context: Pick<vscode.ExtensionContext, 'subscriptions'> = { subscriptions: [] };
    let showErrorMessageSpy: jest.SpyInstance;
    let commandHandler: { command: string; callback: (...args: unknown[]) => void } | undefined;
    const registerCommandMock = vscode.commands.registerCommand as jest.Mock;
    const target = new Target(
        'topo',
        'user@topo.local',
    );
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
        showErrorMessageSpy = jest.spyOn(vscode.window, 'showErrorMessage').mockImplementation(jest.fn());
        registerCommandMock.mockImplementation((command, callback) => {
            if (command !== ContainerStart.startContainerCommand) {
                throw Error('Unexpected command registration');
            }
            commandHandler = { command, callback };
            return { dispose: jest.fn() };
        });
        (vscode.commands.executeCommand as jest.Mock).mockImplementation((command, ...args) => {
            if (command === ContainerStart.startContainerCommand && commandHandler) {
                return commandHandler.callback(...args);
            }
            return Promise.resolve();
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('calls startContainer and shows info message on success', async () => {
        const startContainerSpy = jest.fn(async () => undefined);
        const containersManager = {
            startContainer: startContainerSpy,
        };
        const containerStart = new ContainerStart(context, containersManager);
        await containerStart.activate();

        // Simulate command handler
        await vscode.commands.executeCommand(ContainerStart.startContainerCommand, treeItem);

        expect(startContainerSpy).toHaveBeenCalledWith('abc123');
    });

    it('shows error message if startContainer throws', async () => {
        const containersManager = {
            startContainer: async () => { throw new Error('fail'); },
        };
        const containerStart = new ContainerStart(context, containersManager);
        await containerStart.activate();

        await vscode.commands.executeCommand(ContainerStart.startContainerCommand, treeItem);

        expect(showErrorMessageSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to start the container abc123'));
    });
});
