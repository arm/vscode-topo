import * as vscode from 'vscode';
import { TOPO_TASK_TYPE } from '../manifest';
import { replaceTaskExecution, type TaskExecution } from '../util/task';

export interface TopoTaskDefinition extends vscode.TaskDefinition {
    readonly type: typeof TOPO_TASK_TYPE;
    readonly command: string;
}

export interface TopoTaskFactory<TDefinition extends TopoTaskDefinition> {
    readonly command: TDefinition['command'];
    resolveDefinition(task: vscode.Task): TDefinition | undefined;
    createExecution(definition: TDefinition): TaskExecution;
    createTask(definition: TDefinition): vscode.Task;
}

export class TopoTaskProvider implements vscode.TaskProvider {
    constructor(
        private readonly taskFactories: readonly TopoTaskFactory<TopoTaskDefinition>[],
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
        return replaceTaskExecution(task, execution);
    }
}
