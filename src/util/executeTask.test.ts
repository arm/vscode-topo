import * as vscode from 'vscode';
import { PACKAGE_NAME } from '../manifest';
import { executeTask } from './executeTask';
import { mutable } from './mutable';

type TaskEndListener = (event: vscode.TaskProcessEndEvent) => void;

describe('executeTask', () => {
    const cwd = '/workspace/app';
    const taskExecution: vscode.TaskExecution = {
        task: {} as vscode.Task,
        terminate: jest.fn(),
    };

    let taskEndListener: TaskEndListener | undefined;
    let dispose: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        dispose = jest.fn();
        taskEndListener = undefined;

        jest.mocked(vscode.tasks.executeTask).mockResolvedValue(taskExecution);
        mutable(vscode.tasks).onDidEndTaskProcess = (callback, thisArg) => {
            taskEndListener = thisArg ? callback.bind(thisArg) : callback;
            return { dispose };
        };
    });

    it('creates a VS Code shell task', async () => {
        executeTask('Poto', ['topo', 'poto'], {
            cwd,
        });
        await Promise.resolve();

        expect(vscode.ShellExecution).toHaveBeenCalledWith('topo', ['poto'], {
            cwd,
        });
        expect(vscode.Task).toHaveBeenCalledWith(
            { type: 'shell' },
            vscode.TaskScope.Workspace,
            'Poto',
            PACKAGE_NAME,
            expect.objectContaining({
                executablePath: 'topo',
                executionArgs: ['poto'],
            }),
        );
        expect(vscode.tasks.executeTask).toHaveBeenCalledWith(
            expect.objectContaining({
                presentationOptions: {
                    reveal: vscode.TaskRevealKind.Always,
                    echo: true,
                    focus: true,
                    showReuseMessage: true,
                    clear: true,
                },
            }),
        );
    });

    it('resolves when the task exits successfully', async () => {
        const runningTask = executeTask('Deploy to board', ['foo', 'bar']);
        await Promise.resolve();
        taskEndListener?.({ execution: taskExecution, exitCode: 0 });

        await expect(runningTask).resolves.toBeUndefined();
        expect(dispose).toHaveBeenCalled();
    });

    it('rejects when the matching task exits unsuccessfully', async () => {
        const runningTask = executeTask('Setup keys', ['topo', 'setup-keys']);
        await Promise.resolve();
        taskEndListener?.({
            execution: { task: {} as vscode.Task, terminate: jest.fn() },
            exitCode: 0,
        });
        taskEndListener?.({ execution: taskExecution, exitCode: 1 });

        await expect(runningTask).rejects.toThrow(
            'Setup keys failed with exit code 1',
        );
        expect(dispose).toHaveBeenCalledTimes(1);
    });

    it('sets the task scope to the workspace folder when cwd is specified', async () => {
        const workspaceFolder = {
            uri: vscode.Uri.file(cwd),
            name: 'app',
            index: 0,
        };
        jest.mocked(vscode.workspace.getWorkspaceFolder).mockReturnValue(
            workspaceFolder,
        );

        executeTask('Test Task', ['echo', 'hello'], { cwd });
        await Promise.resolve();

        expect(vscode.Task).toHaveBeenCalledWith(
            expect.anything(),
            workspaceFolder,
            expect.anything(),
            expect.anything(),
            expect.anything(),
        );
    });

    it('fails when no command is provided', async () => {
        await expect(executeTask('Empty Command', [])).rejects.toThrow(
            'No command passed to task',
        );
    });
});
