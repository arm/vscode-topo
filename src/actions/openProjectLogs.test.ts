import * as vscode from 'vscode';
import { mock } from 'vitest-mock-extended';
import { OpenProjectLogs } from './openProjectLogs';
import type { ContainerCommands } from '../services/containerCommands';
import type { TopoCli } from '../services/topoCli';
import { TaskFactory } from '../tasks/taskFactory';
import { loaded } from '../util/loadable';
import type { ContainerItem } from '../util/types';
import { createProjectTreeItem } from '../util/test/projectTreeItem';

vi.mock('../util/logger');

describe('OpenProjectLogs', () => {
    const composeFileUri = vscode.Uri.file('/projects/demo/compose.yaml');
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
    const command = ['podman', 'logs', '--follow', 'web-id', 'worker-id'];
    const containerCommands = mock<ContainerCommands>();
    const action = new OpenProjectLogs(
        containerCommands,
        new TaskFactory(mock<TopoCli>()),
    );

    beforeEach(() => {
        containerCommands.getProjectLogsCommand.mockResolvedValue(command);
    });

    it('opens logs for all project containers', async () => {
        await action.openProjectLogsCommandHandler(project);

        expect(
            containerCommands.getProjectLogsCommand,
        ).toHaveBeenCalledExactlyOnceWith(['web-id', 'worker-id'], target);
        expect(vscode.tasks.executeTask).toHaveBeenCalledOnce();
        const [task] = vi.mocked(vscode.tasks.executeTask).mock.calls[0];
        expect(task).toMatchObject({
            name: `Logs: ${composeFileUri.fsPath} (${target})`,
            execution: {
                command: { value: command[0] },
                args: command.slice(1).map((value) => ({ value })),
            },
            presentationOptions: {
                panel: vscode.TaskPanelKind.Dedicated,
                close: false,
            },
        });
    });

    it('rejects a command without a project tree item', async () => {
        await expect(
            action.openProjectLogsCommandHandler(undefined),
        ).rejects.toThrow('This operation cannot be performed on this item');
        expect(containerCommands.getProjectLogsCommand).not.toHaveBeenCalled();
    });

    it('does nothing for a project without containers', async () => {
        await action.openProjectLogsCommandHandler(
            createProjectTreeItem(composeFileUri, loaded([])),
        );

        expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
        expect(containerCommands.getProjectLogsCommand).not.toHaveBeenCalled();
        expect(vscode.tasks.executeTask).not.toHaveBeenCalled();
    });

    it('propagates command preparation failures', async () => {
        const error = new Error('Target unreachable');
        containerCommands.getProjectLogsCommand.mockRejectedValue(error);

        await expect(
            action.openProjectLogsCommandHandler(project),
        ).rejects.toBe(error);
        expect(vscode.tasks.executeTask).not.toHaveBeenCalled();
    });
});
