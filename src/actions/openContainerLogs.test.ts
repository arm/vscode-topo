import * as vscode from 'vscode';
import { mock } from 'vitest-mock-extended';
import { OpenContainerLogs } from './openContainerLogs';
import type { TaskFactory } from '../tasks/taskFactory';
import { ContainerItem } from '../util/types';
import { ContainerTreeItem } from '../views/treeItems/containerTreeItem';

vi.mock('../util/logger');

describe('OpenContainerLogs', () => {
    const composeFileUri = vscode.Uri.file('/projects/my demo/compose.yaml');
    const container: ContainerItem = {
        id: 'abc123',
        names: 'custom-container-name',
        service: 'web',
        composeFileUri,
        image: 'nginx',
        state: 'exited',
        status: 'Exited (0)',
        processingDomain: 'Linux Host',
        address: '',
        target: 'user@target.local:2222',
    };
    const taskFactory = mock<TaskFactory>();
    const action = new OpenContainerLogs(taskFactory);
    let task: vscode.Task;

    beforeEach(() => {
        task = mock<vscode.Task>();
        taskFactory.createTask.mockReturnValue(task);
    });

    it('follows the selected container service with Topo and keeps the terminal visible after exit', async () => {
        await action.openContainerLogsCommandHandler(
            new ContainerTreeItem(container),
        );

        expect(taskFactory.createTask).toHaveBeenCalledExactlyOnceWith(
            'Logs: custom-container-name (user@target.local:2222)',
            {
                type: 'topo',
                command: 'logs',
                args: [
                    '--file',
                    'compose.yaml',
                    '--target',
                    container.target,
                    '--follow',
                    '--',
                    'web',
                ],
                options: { cwd: vscode.Uri.file('/projects/my demo').fsPath },
            },
        );
        expect(task.presentationOptions).toMatchObject({
            panel: vscode.TaskPanelKind.Dedicated,
            close: false,
        });
        expect(vscode.tasks.executeTask).toHaveBeenCalledExactlyOnceWith(task);
    });

    it('does not open all project logs when the service name is empty', async () => {
        await expect(
            action.openContainerLogsCommandHandler(
                new ContainerTreeItem({ ...container, service: '' }),
            ),
        ).rejects.toThrow('Container abc123 has no Compose service name');
        expect(vscode.tasks.executeTask).not.toHaveBeenCalled();
    });
});
