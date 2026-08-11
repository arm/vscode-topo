import * as vscode from 'vscode';
import { withTaskExecution } from '../util/task';
import { resolveTaskDefinition, type TaskFactory } from './taskFactory';

export class TaskProvider implements vscode.TaskProvider {
    constructor(private readonly taskFactory: TaskFactory) {}

    public provideTasks(): vscode.Task[] {
        return [];
    }

    public resolveTask(task: vscode.Task): vscode.Task | undefined {
        const definition = resolveTaskDefinition(task.definition);
        if (!definition) {
            return undefined;
        }

        const execution = this.taskFactory.createExecution(definition);
        return withTaskExecution(task, execution);
    }
}
