import * as vscode from 'vscode';
import type { TaskExecutor } from '../util/taskExecutor';

export interface TopoTaskSpec<TDefinition extends vscode.TaskDefinition> {
    readonly type: TDefinition['type'];
    resolveDefinition(task: vscode.Task): TDefinition | undefined;
    createArgs(definition: TDefinition): string[];
    createCwd(definition: TDefinition): string | undefined;
    createTaskName(definition: TDefinition): string;
}

export class TopoTaskProvider<TDefinition extends vscode.TaskDefinition>
    implements vscode.TaskProvider
{
    constructor(
        private readonly taskExecutor: TaskExecutor,
        private readonly taskSpec: TopoTaskSpec<TDefinition>,
    ) {}

    public provideTasks(): vscode.Task[] {
        return [];
    }

    public resolveTask(task: vscode.Task): vscode.Task | undefined {
        if (task.definition.type !== this.taskSpec.type) {
            return undefined;
        }

        const resolvedDefinition = this.taskSpec.resolveDefinition(task);
        if (!resolvedDefinition) {
            return undefined;
        }

        task.execution = new vscode.ProcessExecution(
            'topo',
            this.taskSpec.createArgs(resolvedDefinition),
            { cwd: this.taskSpec.createCwd(resolvedDefinition) },
        );
        return this.taskExecutor.resolveProcessTaskBinary(task);
    }
}
