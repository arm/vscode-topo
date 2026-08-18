import * as vscode from 'vscode';
import { createTask, runTask } from './task';
import { mutable } from './test/mutable';
import type { Mock } from 'vitest';

describe('runTask', () => {
    const task = createTask(
        'Fix Debugger',
        new vscode.ProcessExecution('topo', ['install']),
    );
    const taskExecution: vscode.TaskExecution = {
        task,
        terminate: vi.fn(),
    };
    let taskEndListener:
        ((event: vscode.TaskProcessEndEvent) => void) | undefined;
    let dispose: Mock;

    beforeEach(() => {
        vi.clearAllMocks();
        dispose = vi.fn();
        taskEndListener = undefined;
        vi.mocked(vscode.tasks.executeTask).mockResolvedValue(taskExecution);
        mutable(vscode.tasks).onDidEndTaskProcess = (callback, thisArg) => {
            taskEndListener = thisArg ? callback.bind(thisArg) : callback;
            return { dispose };
        };
    });

    it('resolves when the matching task process succeeds', async () => {
        const runningTask = runTask(task);
        await Promise.resolve();
        taskEndListener?.({ execution: taskExecution, exitCode: 0 });

        await expect(runningTask).resolves.toBeUndefined();
        expect(vscode.tasks.executeTask).toHaveBeenCalledWith(task);
        expect(dispose).toHaveBeenCalledOnce();
    });

    it('rejects when the matching task process exits unsuccessfully', async () => {
        const runningTask = runTask(task);
        await Promise.resolve();
        taskEndListener?.({ execution: taskExecution, exitCode: 1 });

        await expect(runningTask).rejects.toThrow(
            'Fix Debugger failed with exit code 1',
        );
        expect(dispose).toHaveBeenCalledOnce();
    });
});
