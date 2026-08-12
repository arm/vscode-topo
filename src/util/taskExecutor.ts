import * as vscode from 'vscode';
import { runTask } from './task';
import { TopoCli } from '../services/topoCli';

export class TaskExecutor {
    constructor(private readonly topoCli: TopoCli) {}

    public async run(task: vscode.Task): Promise<void> {
        const executableTask = this.resolveProcessTaskBinary(task);
        await runTask(executableTask);
    }

    private resolveProcessTaskBinary(task: vscode.Task): vscode.Task {
        const execution = task.execution;
        if (!(execution instanceof vscode.ProcessExecution)) {
            return task;
        }

        if (execution.process !== 'topo') {
            return task;
        }

        execution.process = this.topoCli.getBinaryPath();
        return task;
    }
}
