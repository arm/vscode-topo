import { TARGET_HOST_RUNTIME } from '../manifest';
import * as vscode from 'vscode';
import { ContainerStart } from './containerStart';
import { TargetContainerTreeItem } from '../targetTreeView/targetContainerTreeItem';
import { WrappedError } from '../errors/wrappedError';
import { mock } from 'vitest-mock-extended';
import { ContainerItem } from '../util/types';
import { ContainerCommands } from '../target/containerCommands';
import type { MockInstance } from 'vitest';

describe('ContainerStart', () => {
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

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('calls startContainer and shows info message on success', async () => {
        const containerCommands = mock<ContainerCommands>();
        const containerStart = new ContainerStart(containerCommands);

        await containerStart.startContainerCommandHandler(treeItem);

        expect(containerCommands.startContainer).toHaveBeenCalledWith(
            'abc123',
            target,
        );
    });

    it('shows error message if startContainer throws a WrappedError', async () => {
        const containerCommands = mock<ContainerCommands>();
        containerCommands.startContainer.mockRejectedValue(
            new WrappedError('DOCKER', 'fail'),
        );
        const containerStart = new ContainerStart(containerCommands);

        await containerStart.startContainerCommandHandler(treeItem);

        expect(showErrorMessageSpy).toHaveBeenCalledWith(
            expect.stringContaining(
                'Failed to start the container abc123. fail',
            ),
        );
    });

    it('re-throws generic error errors from startContainer', async () => {
        const containerCommands = mock<ContainerCommands>();
        containerCommands.startContainer.mockRejectedValue(
            new Error('generic error'),
        );
        const containerStart = new ContainerStart(containerCommands);

        await expect(
            containerStart.startContainerCommandHandler(treeItem),
        ).rejects.toThrow('generic error');
    });
});
