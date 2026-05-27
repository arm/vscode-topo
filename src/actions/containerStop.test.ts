import { TARGET_HOST_RUNTIME } from '../manifest';
import * as vscode from 'vscode';
import { ContainerStop } from './containerStop';
import { ContainerItem } from '../util/types';
import { TargetContainerTreeItem } from '../targetTreeView/targetContainerTreeItem';
import { WrappedError } from '../errors/wrappedError';
import { mock, MockProxy } from 'vitest-mock-extended';
import { ContainerCommands } from '../target/containerCommands';
import { executeCommand } from '../util/test/executeCommand';
import type { MockInstance } from 'vitest';

describe('ContainerStop', () => {
    let context: MockProxy<vscode.ExtensionContext>;
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
        context = mock<vscode.ExtensionContext>({ subscriptions: [] });
        showErrorMessageSpy = vi
            .spyOn(vscode.window, 'showErrorMessage')
            .mockImplementation(vi.fn());
    });
    it('calls stopContainer and shows info message on success', async () => {
        const containerCommands = mock<ContainerCommands>();
        const containerStop = new ContainerStop(context, containerCommands);
        containerStop.activate();

        await executeCommand(ContainerStop.stopContainerCommand, treeItem);

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
        const containerStop = new ContainerStop(context, containerCommands);
        containerStop.activate();

        await executeCommand(ContainerStop.stopContainerCommand, treeItem);

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
        const containerStop = new ContainerStop(context, containerCommands);
        containerStop.activate();

        await expect(
            executeCommand(ContainerStop.stopContainerCommand, treeItem),
        ).rejects.toThrow('generic error');
    });
});
