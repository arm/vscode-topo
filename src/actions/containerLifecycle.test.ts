import * as vscode from 'vscode';
import { mock } from 'vitest-mock-extended';
import type { MockInstance } from 'vitest';
import { ProjectController } from '../controllers/projectController';
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
    let showErrorMessageSpy: MockInstance;
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
        showErrorMessageSpy = vi
            .spyOn(vscode.window, 'showErrorMessage')
            .mockImplementation(vi.fn());
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it.each(lifecycleCases)(
        '$operation invokes the matching command and refreshes containers',
        async ({ command, invoke }) => {
            const containerCommands = mock<ContainerCommands>();
            const projectController = mock<ProjectController>();
            const lifecycle = new ContainerLifecycle(
                containerCommands,
                projectController,
            );

            await invoke(lifecycle, treeItem);

            expect(containerCommands[command]).toHaveBeenCalledWith(
                container.id,
                target,
            );
            expect(
                projectController.refreshProjectContainersCommandHandler,
            ).toHaveBeenCalledOnce();
        },
    );

    it.each(lifecycleCases)(
        '$operation reports Docker errors without refreshing containers',
        async ({ operation, command, invoke }) => {
            const containerCommands = mock<ContainerCommands>();
            const projectController = mock<ProjectController>();
            containerCommands[command].mockRejectedValue(
                new WrappedError('DOCKER', 'fail'),
            );
            const lifecycle = new ContainerLifecycle(
                containerCommands,
                projectController,
            );

            await invoke(lifecycle, treeItem);

            expect(showErrorMessageSpy).toHaveBeenCalledWith(
                expect.stringContaining(
                    `Failed to ${operation} the container ${container.id}. fail`,
                ),
            );
            expect(
                projectController.refreshProjectContainersCommandHandler,
            ).not.toHaveBeenCalled();
        },
    );

    it('rethrows unexpected command errors', async () => {
        const containerCommands = mock<ContainerCommands>();
        containerCommands.startContainer.mockRejectedValue(
            new Error('generic error'),
        );
        const lifecycle = new ContainerLifecycle(
            containerCommands,
            mock<ProjectController>(),
        );

        await expect(
            lifecycle.startContainerCommandHandler(treeItem),
        ).rejects.toThrow('generic error');
    });
});
