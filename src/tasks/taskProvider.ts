import * as vscode from 'vscode';
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
        const resolvedTask = new vscode.Task(
            task.definition,
            task.scope ?? vscode.TaskScope.Workspace,
            task.name,
            task.source,
            execution,
            task.problemMatchers,
        );
        resolvedTask.presentationOptions = task.presentationOptions;
        resolvedTask.group = task.group;
        resolvedTask.isBackground = task.isBackground;
        resolvedTask.runOptions = task.runOptions;
        resolvedTask.detail = task.detail;
        return resolvedTask;
    }
}
