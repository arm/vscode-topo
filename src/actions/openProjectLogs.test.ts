import * as vscode from 'vscode';
import { mock } from 'vitest-mock-extended';
import { OpenProjectLogs } from './openProjectLogs';
import type { TaskFactory } from '../tasks/taskFactory';
import { loaded, unloaded } from '../util/loadable';
import type { ContainerItem } from '../util/types';
import { createProjectTreeItem } from '../util/test/projectTreeItem';

vi.mock('../util/logger');

describe('OpenProjectLogs', () => {
    const composeFileUri = vscode.Uri.file('/projects/my demo/compose.yaml');
    const target = 'user@target.local:2222';
    const containers = [
        mock<ContainerItem>({
            id: 'web-id',
            state: 'running',
            target,
        }),
        mock<ContainerItem>({
            id: 'worker-id',
            state: 'exited',
            target,
        }),
    ];
    const project = createProjectTreeItem(composeFileUri, loaded(containers));
    const taskFactory = mock<TaskFactory>();
    const action = new OpenProjectLogs(taskFactory);
    let task: vscode.Task;

    beforeEach(() => {
        task = mock<vscode.Task>();
        taskFactory.createTask.mockReturnValue(task);
    });

    it('follows all project services with Topo in the project directory', async () => {
        await action.openProjectLogsCommandHandler(project);

        expect(taskFactory.createTask).toHaveBeenCalledExactlyOnceWith(
            `Logs: ${composeFileUri.fsPath} (${target})`,
            {
                type: 'topo',
                command: 'logs',
                args: [
                    '--file',
                    'compose.yaml',
                    '--target',
                    target,
                    '--follow',
                    '--',
                ],
                options: { cwd: vscode.Uri.file('/projects/my demo').fsPath },
            },
        );
        expect(vscode.tasks.executeTask).toHaveBeenCalledExactlyOnceWith(task);
    });

    it.each([loaded([]), unloaded()])(
        'does nothing without loaded containers (%j)',
        async (containers) => {
            await action.openProjectLogsCommandHandler(
                createProjectTreeItem(composeFileUri, containers),
            );

            expect(vscode.tasks.executeTask).not.toHaveBeenCalled();
        },
    );
});
