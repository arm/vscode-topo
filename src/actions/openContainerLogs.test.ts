import * as vscode from 'vscode';
import { mock } from 'vitest-mock-extended';
import { OpenContainerLogs } from './openContainerLogs';
import { DockerCommands } from '../services/dockerCommands';
import type { ContainerCommands } from '../services/containerCommands';
import { TopoCli } from '../services/topoCli';
import { TaskFactory } from '../tasks/taskFactory';
import { ContainerItem } from '../util/types';
import { ContainerTreeItem } from '../views/treeItems/containerTreeItem';

vi.mock('../util/logger');

describe('OpenContainerLogs', () => {
    const container: ContainerItem = {
        id: 'abc123',
        names: 'web-1',
        image: 'nginx',
        state: 'exited',
        status: 'Exited (0)',
        processingDomain: 'Linux Host',
        address: '',
        target: 'user@target.local:2222',
    };
    const action = new OpenContainerLogs(
        new DockerCommands(),
        new TaskFactory(mock<TopoCli>()),
    );

    it('opens the selected container logs and keeps the terminal visible after exit', async () => {
        await action.openContainerLogsCommandHandler(
            new ContainerTreeItem(container),
        );

        expect(vscode.tasks.executeTask).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({
                name: 'Logs: web-1 (user@target.local:2222)',
                execution: expect.objectContaining({
                    command: {
                        value: 'docker',
                        quoting: vscode.ShellQuoting.Strong,
                    },
                    args: [
                        '--host',
                        'ssh://user@target.local:2222',
                        'logs',
                        '--follow',
                        '--',
                        'abc123',
                    ].map((value) => ({
                        value,
                        quoting: vscode.ShellQuoting.Strong,
                    })),
                }),
                presentationOptions: expect.objectContaining({
                    reveal: vscode.TaskRevealKind.Always,
                    focus: true,
                    panel: vscode.TaskPanelKind.Dedicated,
                    close: false,
                }),
            }),
        );
    });

    it.skipIf(process.platform === 'win32')(
        'escapes embedded quotes in generated log tasks',
        async () => {
            const commands = mock<ContainerCommands>();
            commands.getLogsCommand.mockReturnValue([
                'ssh',
                'target',
                "podman logs 'abc123'",
            ]);
            const logAction = new OpenContainerLogs(
                commands,
                new TaskFactory(mock<TopoCli>()),
            );

            await logAction.openContainerLogsCommandHandler(
                new ContainerTreeItem(container),
            );

            const task = vi.mocked(vscode.tasks.executeTask).mock.calls[0][0];
            const execution = task.execution as vscode.ShellExecution;
            expect(execution.args?.at(-1)).toEqual({
                value: "podman logs '\\''abc123'\\''",
                quoting: vscode.ShellQuoting.Strong,
            });
        },
    );
});
