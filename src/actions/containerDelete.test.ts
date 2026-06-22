import * as vscode from 'vscode';
import { ContainerDelete } from './containerDelete';
import { ContainerItem } from '../util/types';
import { ContainerTreeItem } from '../treeItems/containerTreeItem';
import { WrappedError } from '../errors/wrappedError';
import { mock } from 'vitest-mock-extended';
import { ContainerCommands } from '../target/containerCommands';
import type { MockInstance } from 'vitest';
import { TargetController } from '../controllers/targetController';

describe('ContainerDelete', () => {
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

    it('calls deleteContainer on success', async () => {
        const containerCommands = mock<ContainerCommands>();
        const targetController = mock<TargetController>();
        const containerDelete = new ContainerDelete(
            containerCommands,
            targetController,
        );

        await containerDelete.deleteContainerCommandHandler(treeItem);

        expect(containerCommands.deleteContainer).toHaveBeenCalledWith(
            'abc123',
            target,
        );
        expect(
            targetController.refreshSelectedTargetHealthCommandHandler,
        ).toHaveBeenCalledOnce();
    });

    it('shows error message if deleteContainer throws a WrappedError', async () => {
        const containerCommands = mock<ContainerCommands>();
        const targetController = mock<TargetController>();
        containerCommands.deleteContainer.mockRejectedValue(
            new WrappedError('DOCKER', 'fail'),
        );
        const containerDelete = new ContainerDelete(
            containerCommands,
            targetController,
        );

        await containerDelete.deleteContainerCommandHandler(treeItem);

        expect(showErrorMessageSpy).toHaveBeenCalledWith(
            expect.stringContaining(
                'Failed to delete the container abc123. fail',
            ),
        );
        expect(
            targetController.refreshSelectedTargetHealthCommandHandler,
        ).not.toHaveBeenCalled();
    });

    it('re-throws generic errors from deleteContainer', async () => {
        const containerCommands = mock<ContainerCommands>();
        containerCommands.deleteContainer.mockRejectedValue(
            new Error('generic error'),
        );
        const containerDelete = new ContainerDelete(
            containerCommands,
            mock<TargetController>(),
        );

        await expect(
            containerDelete.deleteContainerCommandHandler(treeItem),
        ).rejects.toThrow('generic error');
    });
});
