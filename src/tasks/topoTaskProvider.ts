import * as vscode from 'vscode';
import { replaceTaskExecution, type TaskExecution } from '../util/task';

export interface TopoTaskFactory<TDefinition extends vscode.TaskDefinition> {
    readonly type: TDefinition['type'];
    resolveDefinition(task: vscode.Task): TDefinition | undefined;
    createExecution(definition: TDefinition): TaskExecution;
    createTask(definition: TDefinition): vscode.Task;
}

export class TopoTaskProvider<TDefinition extends vscode.TaskDefinition>
    implements vscode.TaskProvider
{
    constructor(private readonly taskFactory: TopoTaskFactory<TDefinition>) {}

    public provideTasks(): vscode.Task[] {
        return [];
    }

    public resolveTask(task: vscode.Task): vscode.Task | undefined {
        if (task.definition.type !== this.taskFactory.type) {
            return undefined;
        }

        const resolvedDefinition = this.taskFactory.resolveDefinition(task);
        if (!resolvedDefinition) {
            return undefined;
        }

        const execution = this.taskFactory.createExecution(resolvedDefinition);
        return replaceTaskExecution(task, execution);
    }
}
