import * as vscode from 'vscode';
import { waitForTaskProcess } from './task';
import { TopoCli } from '../services/topoCli';

export class TaskExecutor {
    constructor(private readonly topoCli: TopoCli) {}

    public async run(task: vscode.Task): Promise<void> {
        const executableTask = this.resolveProcessTaskBinary(task);
        const taskExecution = await vscode.tasks.executeTask(executableTask);
        await waitForTaskProcess(taskExecution, task.name);
    }

    public resolveProcessTaskBinary(task: vscode.Task): vscode.Task {
        const execution = task.execution;
        if (!(execution instanceof vscode.ProcessExecution)) {
            return task;
        }

        if (execution.process !== 'topo') {
            return task;
        }

        const resolvedExecution = new vscode.ProcessExecution(
            this.topoCli.getBinaryPath(),
            execution.args,
            execution.options,
        );
        task.execution = resolvedExecution;
        return task;
    }
}
