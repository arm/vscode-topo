import * as vscode from 'vscode';
import { ContainerStop } from './containerStop';
import { ContainerItem } from '../util/types';
import { ContainerTreeItem } from '../views/treeItems/containerTreeItem';
import { WrappedError } from '../errors/wrappedError';
import { mock } from 'vitest-mock-extended';
import { ContainerCommands } from '../services/containerCommands';
import type { MockInstance } from 'vitest';
import { ProjectController } from '../controllers/projectController';

describe('ContainerStop', () => {
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

    it('calls stopContainer and shows info message on success', async () => {
        const containerCommands = mock<ContainerCommands>();
        const projectController = mock<ProjectController>();
        const containerStop = new ContainerStop(
            containerCommands,
            projectController,
        );

        await containerStop.stopContainerCommandHandler(treeItem);

        expect(containerCommands.stopContainer).toHaveBeenCalledWith(
            'abc123',
            target,
        );
        expect(
            projectController.refreshProjectContainersCommandHandler,
        ).toHaveBeenCalledOnce();
    });

    it('shows error message if stopContainer throws a WrappedError', async () => {
        const containerCommands = mock<ContainerCommands>();
        const projectController = mock<ProjectController>();
        containerCommands.stopContainer.mockRejectedValue(
            new WrappedError('DOCKER', 'fail'),
        );
        const containerStop = new ContainerStop(
            containerCommands,
            projectController,
        );

        await containerStop.stopContainerCommandHandler(treeItem);

        expect(showErrorMessageSpy).toHaveBeenCalledWith(
            expect.stringContaining(
                'Failed to stop the container abc123. fail',
            ),
        );
        expect(
            projectController.refreshProjectContainersCommandHandler,
        ).not.toHaveBeenCalled();
    });

    it('re-throw generic error errors from stopContainer', async () => {
        const containerCommands = mock<ContainerCommands>();
        containerCommands.stopContainer.mockRejectedValue(
            new Error('generic error'),
        );
        const containerStop = new ContainerStop(
            containerCommands,
            mock<ProjectController>(),
        );

        await expect(
            containerStop.stopContainerCommandHandler(treeItem),
        ).rejects.toThrow('generic error');
    });
});
