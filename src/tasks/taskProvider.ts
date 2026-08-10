import * as vscode from 'vscode';
import { TOPO_TASK_TYPE } from '../manifest';
import { withTaskExecution, type TaskExecution } from '../util/task';

export interface TaskDefinition extends vscode.TaskDefinition {
    readonly type: typeof TOPO_TASK_TYPE;
    readonly command: string;
}

export interface TaskFactory<TDefinition extends TaskDefinition> {
    readonly command: TDefinition['command'];
    resolveDefinition(task: vscode.Task): TDefinition | undefined;
    createExecution(definition: TDefinition): TaskExecution;
    createTask(definition: TDefinition): vscode.Task;
}

export class TaskProvider implements vscode.TaskProvider {
    constructor(
        private readonly taskFactories: readonly TaskFactory<TaskDefinition>[],
    ) {}

    public provideTasks(): vscode.Task[] {
        return [];
    }

    public resolveTask(task: vscode.Task): vscode.Task | undefined {
        const { command, type } = task.definition;
        if (type !== TOPO_TASK_TYPE || typeof command !== 'string') {
            return undefined;
        }

        const taskFactory = this.taskFactories.find(
            (factory) => factory.command === command,
        );
        if (!taskFactory) {
            return undefined;
        }

        const resolvedDefinition = taskFactory.resolveDefinition(task);
        if (!resolvedDefinition) {
            return undefined;
        }

        const execution = taskFactory.createExecution(resolvedDefinition);
        return withTaskExecution(task, execution);
    }
}
