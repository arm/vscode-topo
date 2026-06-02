import { TARGET_HOST_RUNTIME } from '../manifest';
import * as vscode from 'vscode';
import { ContainerStop } from './containerStop';
import { ContainerItem } from '../util/types';
import { TargetContainerTreeItem } from '../targetTreeView/targetContainerTreeItem';
import { WrappedError } from '../errors/wrappedError';
import { mock } from 'vitest-mock-extended';
import { ContainerCommands } from '../target/containerCommands';
import type { MockInstance } from 'vitest';

describe('ContainerStop', () => {
    let showErrorMessageSpy: MockInstance;
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
        showErrorMessageSpy = vi
            .spyOn(vscode.window, 'showErrorMessage')
            .mockImplementation(vi.fn());
    });

    it('calls stopContainer and shows info message on success', async () => {
        const containerCommands = mock<ContainerCommands>();
        const containerStop = new ContainerStop(containerCommands);

        await containerStop.stopContainerCommandHandler(treeItem);

        expect(containerCommands.stopContainer).toHaveBeenCalledWith(
            'abc123',
            target,
        );
    });

    it('shows error message if stopContainer throws a WrappedError', async () => {
        const containerCommands = mock<ContainerCommands>();
        containerCommands.stopContainer.mockRejectedValue(
            new WrappedError('DOCKER', 'fail'),
        );
        const containerStop = new ContainerStop(containerCommands);

        await containerStop.stopContainerCommandHandler(treeItem);

        expect(showErrorMessageSpy).toHaveBeenCalledWith(
            expect.stringContaining(
                'Failed to stop the container abc123. fail',
            ),
        );
    });

    it('re-throw generic error errors from stopContainer', async () => {
        const containerCommands = mock<ContainerCommands>();
        containerCommands.stopContainer.mockRejectedValue(
            new Error('generic error'),
        );
        const containerStop = new ContainerStop(containerCommands);

        await expect(
            containerStop.stopContainerCommandHandler(treeItem),
        ).rejects.toThrow('generic error');
    });
});
