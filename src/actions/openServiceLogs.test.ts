import * as vscode from 'vscode';
import { mock } from 'vitest-mock-extended';
import { OpenServiceLogs } from './openServiceLogs';
import type { TaskFactory } from '../tasks/taskFactory';
import { ContainerItem } from '../util/types';
import { ContainerTreeItem } from '../views/treeItems/containerTreeItem';

vi.mock('../util/logger');

describe('OpenServiceLogs', () => {
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
    const action = new OpenServiceLogs(taskFactory);
    let task: vscode.Task;

    beforeEach(() => {
        task = mock<vscode.Task>();
        taskFactory.createTask.mockReturnValue(task);
    });

    it('follows the selected service with Topo', async () => {
        await action.openServiceLogsCommandHandler(
            new ContainerTreeItem(container),
        );

        expect(taskFactory.createTask).toHaveBeenCalledExactlyOnceWith(
            'Logs: web (user@target.local:2222)',
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
        expect(vscode.tasks.executeTask).toHaveBeenCalledExactlyOnceWith(task);
    });

    it('keeps the dedicated logs terminal visible after exit', async () => {
        await action.openServiceLogsCommandHandler(
            new ContainerTreeItem(container),
        );

        expect(task.presentationOptions).toMatchObject({
            panel: vscode.TaskPanelKind.Dedicated,
            close: false,
        });
    });

    it('does not open all project logs when the service name is empty', async () => {
        await expect(
            action.openServiceLogsCommandHandler(
                new ContainerTreeItem({ ...container, service: '' }),
            ),
        ).rejects.toThrow('Container abc123 has no Compose service name');
        expect(vscode.tasks.executeTask).not.toHaveBeenCalled();
    });
});
