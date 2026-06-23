import * as vscode from 'vscode';
import { ContainerStart } from './containerStart';
import { ContainerTreeItem } from '../treeItems/containerTreeItem';
import { WrappedError } from '../errors/wrappedError';
import { mock } from 'vitest-mock-extended';
import { ContainerItem } from '../util/types';
import { ContainerCommands } from '../target/containerCommands';
import type { MockInstance } from 'vitest';
import { ProjectController } from '../controllers/projectController';

describe('ContainerStart', () => {
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

    it('calls startContainer and shows info message on success', async () => {
        const containerCommands = mock<ContainerCommands>();
        const projectController = mock<ProjectController>();
        const containerStart = new ContainerStart(
            containerCommands,
            projectController,
        );

        await containerStart.startContainerCommandHandler(treeItem);

        expect(containerCommands.startContainer).toHaveBeenCalledWith(
            'abc123',
            target,
        );
        expect(
            projectController.refreshProjectContainersCommandHandler,
        ).toHaveBeenCalledOnce();
    });

    it('shows error message if startContainer throws a WrappedError', async () => {
        const containerCommands = mock<ContainerCommands>();
        const projectController = mock<ProjectController>();
        containerCommands.startContainer.mockRejectedValue(
            new WrappedError('DOCKER', 'fail'),
        );
        const containerStart = new ContainerStart(
            containerCommands,
            projectController,
        );

        await containerStart.startContainerCommandHandler(treeItem);

        expect(showErrorMessageSpy).toHaveBeenCalledWith(
            expect.stringContaining(
                'Failed to start the container abc123. fail',
            ),
        );
        expect(
            projectController.refreshProjectContainersCommandHandler,
        ).not.toHaveBeenCalled();
    });

    it('re-throws generic error errors from startContainer', async () => {
        const containerCommands = mock<ContainerCommands>();
        containerCommands.startContainer.mockRejectedValue(
            new Error('generic error'),
        );
        const containerStart = new ContainerStart(
            containerCommands,
            mock<ProjectController>(),
        );

        await expect(
            containerStart.startContainerCommandHandler(treeItem),
        ).rejects.toThrow('generic error');
    });
});
