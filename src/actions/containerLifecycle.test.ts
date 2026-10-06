import * as vscode from 'vscode';
import { mock } from 'vitest-mock-extended';
import { refreshProjectContainers } from '../commandIds';
import { WrappedError } from '../errors/wrappedError';
import { ContainerCommands } from '../services/containerCommands';
import { ContainerItem } from '../util/types';
import { ContainerTreeItem } from '../views/treeItems/containerTreeItem';
import { ContainerLifecycle } from './containerLifecycle';

type LifecycleCase = {
    operation: 'start' | 'stop' | 'delete';
    command: 'startContainer' | 'stopContainer' | 'deleteContainer';
    invoke: (
        lifecycle: ContainerLifecycle,
        treeItem: ContainerTreeItem,
    ) => Promise<void>;
};

const lifecycleCases = [
    {
        operation: 'start',
        command: 'startContainer',
        invoke: (lifecycle, treeItem) =>
            lifecycle.startContainerCommandHandler(treeItem),
    },
    {
        operation: 'stop',
        command: 'stopContainer',
        invoke: (lifecycle, treeItem) =>
            lifecycle.stopContainerCommandHandler(treeItem),
    },
    {
        operation: 'delete',
        command: 'deleteContainer',
        invoke: (lifecycle, treeItem) =>
            lifecycle.deleteContainerCommandHandler(treeItem),
    },
] satisfies LifecycleCase[];

describe('ContainerLifecycle', () => {
    const target = 'user@topo.local';
    const container: ContainerItem = {
        id: 'abc123',
        names: 'my-container',
        image: 'nginx',
        state: 'running',
        status: 'Up',
        processingDomain: 'CoolProcessingDomain',
        address: '1.2.3.4:5678',
        target,
    };
    const treeItem = new ContainerTreeItem(container);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each(lifecycleCases)(
        '$operation invokes the matching command and refreshes containers',
        async ({ command, invoke }) => {
            const containerCommands = mock<ContainerCommands>();
            const lifecycle = new ContainerLifecycle(containerCommands);

            await invoke(lifecycle, treeItem);

            expect(containerCommands[command]).toHaveBeenCalledWith(
                container.id,
                target,
            );
            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                refreshProjectContainers,
            );
        },
    );

    it.each(['ENGINE', 'DOCKER', 'PODMAN'] as const)(
        'reports %s failures without refreshing containers',
        async (engine) => {
            const containerCommands = mock<ContainerCommands>();
            containerCommands.startContainer.mockRejectedValue(
                new WrappedError(engine, 'fail'),
            );
            const lifecycle = new ContainerLifecycle(containerCommands);

            await lifecycle.startContainerCommandHandler(treeItem);

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining(
                    `Failed to start the container ${container.id}. fail`,
                ),
            );
            expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith(
                refreshProjectContainers,
            );
        },
    );

    it('rethrows unexpected command errors', async () => {
        const containerCommands = mock<ContainerCommands>();
        containerCommands.startContainer.mockRejectedValue(
            new Error('generic error'),
        );
        const lifecycle = new ContainerLifecycle(containerCommands);

        await expect(
            lifecycle.startContainerCommandHandler(treeItem),
        ).rejects.toThrow('generic error');
    });
});
