import * as vscode from 'vscode';
import { waitForTaskProcess } from './task';
import { TopoCli } from '../topoCli';

export class TaskExecutor {
    constructor(private readonly topoCli: TopoCli) {}

    public async run(task: vscode.Task): Promise<void> {
        const executableTask = this.resolveProcessTaskBinary(task);
        const taskExecution = await vscode.tasks.executeTask(executableTask);
        await waitForTaskProcess(taskExecution, task.name);
    }

    private resolveProcessTaskBinary(task: vscode.Task): vscode.Task {
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
        const resolvedTask = new vscode.Task(
            task.definition,
            task.scope ?? vscode.TaskScope.Workspace,
            task.name,
            task.source,
            resolvedExecution,
            task.problemMatchers,
        );
        resolvedTask.presentationOptions = task.presentationOptions;
        resolvedTask.group = task.group;
        resolvedTask.isBackground = task.isBackground;
        return resolvedTask;
    }
}
