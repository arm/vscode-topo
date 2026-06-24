import * as vscode from 'vscode';
import path from 'node:path';
import { TaskExecutor } from './taskExecutor';
import { createProcessTask } from './task';
import { mutable } from './mutable';
import { TopoCli } from '../topoCli';
import { mock, MockProxy } from 'vitest-mock-extended';
import type { Mock } from 'vitest';

describe('TaskExecutor', () => {
    const topoBinaryPath = path.join(
        'fake',
        'extension',
        'resources',
        process.platform === 'win32' ? 'topo.exe' : 'topo',
    );
    const taskExecution: vscode.TaskExecution = {
        task: {} as vscode.Task,
        terminate: vi.fn(),
    };

    let taskEndListener:
        | ((event: vscode.TaskProcessEndEvent) => void)
        | undefined;
    let dispose: Mock;
    let topoCli: MockProxy<TopoCli>;

    beforeEach(() => {
        vi.clearAllMocks();
        dispose = vi.fn();
        taskEndListener = undefined;
        topoCli = mock<TopoCli>();
        topoCli.getBinaryPath.mockReturnValue(topoBinaryPath);

        vi.mocked(vscode.tasks.executeTask).mockResolvedValue(taskExecution);
        mutable(vscode.tasks).onDidEndTaskProcess = (callback, thisArg) => {
            taskEndListener = thisArg ? callback.bind(thisArg) : callback;
            return { dispose };
        };
    });

    it('resolves registered process task binaries before execution', async () => {
        const executor = new TaskExecutor(topoCli);
        const task = createProcessTask('Deploy', [
            'topo',
            'deploy',
            '--target',
            'topo.local',
        ]);

        const runningTask = executor.run(task);
        await Promise.resolve();
        taskEndListener?.({ execution: taskExecution, exitCode: 0 });
        await runningTask;

        expect(vscode.tasks.executeTask).toHaveBeenCalledWith(
            expect.objectContaining({
                execution: expect.objectContaining({
                    process: topoBinaryPath,
                    args: ['deploy', '--target', 'topo.local'],
                    options: expect.objectContaining({
                        env: expect.any(Object),
                    }),
                }),
                presentationOptions: task.presentationOptions,
            }),
        );
    });

    it('leaves non-topo process task commands unchanged', async () => {
        const executor = new TaskExecutor(topoCli);
        const task = createProcessTask('Unexpected', ['docker', 'ps']);

        const runningTask = executor.run(task);
        await Promise.resolve();
        taskEndListener?.({ execution: taskExecution, exitCode: 0 });
        await runningTask;

        expect(vscode.tasks.executeTask).toHaveBeenCalledWith(
            expect.objectContaining({
                execution: expect.objectContaining({
                    process: 'docker',
                    args: ['ps'],
                }),
            }),
        );
    });

    it('rejects when the matching task process exits unsuccessfully', async () => {
        const executor = new TaskExecutor(topoCli);
        const task = createProcessTask('Fix Debugger', ['topo', 'install']);

        const runningTask = executor.run(task);
        await Promise.resolve();
        taskEndListener?.({ execution: taskExecution, exitCode: 1 });

        await expect(runningTask).rejects.toThrow(
            'Fix Debugger failed with exit code 1',
        );
        expect(dispose).toHaveBeenCalledTimes(1);
    });
});
