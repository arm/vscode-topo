import { TARGET_HOST_RUNTIME } from '../manifest';
import * as vscode from 'vscode';
import { ContainerDelete } from './containerDelete';
import { ContainerItem } from '../util/types';
import { TargetContainerTreeItem } from '../targetTreeView/targetContainerTreeItem';
import { WrappedError } from '../errors/wrappedError';
import { mock, MockProxy } from 'jest-mock-extended';
import { ContainerCommands } from '../target/containerCommands';
import { executeCommand } from '../util/test/executeCommand';

describe('ContainerDelete', () => {
    let context: MockProxy<vscode.ExtensionContext>;
    let showErrorMessageSpy: jest.SpyInstance;

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
        showErrorMessageSpy = jest
            .spyOn(vscode.window, 'showErrorMessage')
            .mockImplementation(jest.fn());
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('calls deleteContainer on success', async () => {
        const containerCommands = mock<ContainerCommands>();
        const containerDelete = new ContainerDelete(context, containerCommands);
        containerDelete.activate();

        await executeCommand(ContainerDelete.deleteContainerCommand, treeItem);

        expect(containerCommands.deleteContainer).toHaveBeenCalledWith(
            'abc123',
            target,
        );
    });

    it('shows error message if deleteContainer throws a WrappedError', async () => {
        const containerCommands = mock<ContainerCommands>();
        containerCommands.deleteContainer.mockRejectedValue(
            new WrappedError('DOCKER', 'fail'),
        );
        const containerDelete = new ContainerDelete(context, containerCommands);
        containerDelete.activate();

        await executeCommand(ContainerDelete.deleteContainerCommand, treeItem);

        expect(showErrorMessageSpy).toHaveBeenCalledWith(
            expect.stringContaining(
                'Failed to delete the container abc123. fail',
            ),
        );
    });

    it('re-throws generic errors from deleteContainer', async () => {
        const containerCommands = mock<ContainerCommands>();
        containerCommands.deleteContainer.mockRejectedValue(
            new Error('generic error'),
        );
        const containerDelete = new ContainerDelete(context, containerCommands);
        containerDelete.activate();

        await expect(
            executeCommand(ContainerDelete.deleteContainerCommand, treeItem),
        ).rejects.toThrow('generic error');
    });
});
