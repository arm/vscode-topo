import { TARGET_HOST_RUNTIME } from '../manifest';
import * as vscode from 'vscode';
import { ContainerStart } from './containerStart';
import { TargetContainerTreeItem } from '../targetTreeView/targetContainerTreeItem';
import { WrappedError } from '../errors/wrappedError';
import { mock, MockProxy } from 'vitest-mock-extended';
import { ContainerItem } from '../util/types';
import { ContainerCommands } from '../target/containerCommands';
import { executeCommand } from '../util/test/executeCommand';
import type { MockInstance } from 'vitest';

describe('ContainerStart', () => {
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

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('calls startContainer and shows info message on success', async () => {
        const containerCommands = mock<ContainerCommands>();
        const containerStart = new ContainerStart(context, containerCommands);
        containerStart.activate();

        await executeCommand(ContainerStart.startContainerCommand, treeItem);

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
        const containerStart = new ContainerStart(context, containerCommands);
        containerStart.activate();

        await executeCommand(ContainerStart.startContainerCommand, treeItem);

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
        const containerStart = new ContainerStart(context, containerCommands);
        containerStart.activate();

        await expect(
            executeCommand(ContainerStart.startContainerCommand, treeItem),
        ).rejects.toThrow('generic error');
    });
});
