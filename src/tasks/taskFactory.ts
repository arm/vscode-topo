import * as vscode from 'vscode';
import { array, enums, is, literal, string, type } from 'superstruct';
import { TOPO_TASK_TYPE } from '../manifest';
import type { TopoCli } from '../services/topoCli';
import { createTask } from '../util/task';

export enum TaskCommand {
    Configure = 'configure',
    Deploy = 'deploy',
    Health = 'health',
    Install = 'install',
    Projects = 'projects',
    Ps = 'ps',
    SetupKeys = 'setup-keys',
    Stop = 'stop',
}

const taskDefinitionSchema = type({
    type: literal(TOPO_TASK_TYPE),
    command: enums(Object.values(TaskCommand)),
    args: array(string()),
});

export interface TaskDefinition extends vscode.TaskDefinition {
    readonly type: typeof TOPO_TASK_TYPE;
    readonly command: TaskCommand;
    readonly args: readonly string[];
    readonly options?: vscode.ProcessExecutionOptions;
}

export const resolveTaskDefinition = (
    definition: vscode.TaskDefinition,
): TaskDefinition | undefined => {
    return is(definition, taskDefinitionSchema) ? definition : undefined;
};

export class TaskFactory {
    constructor(private readonly topoCli: TopoCli) {}

    public createExecution(
        definition: TaskDefinition,
    ): vscode.ProcessExecution {
        return new vscode.ProcessExecution(
            this.topoCli.getBinaryPath(),
            [definition.command, ...definition.args],
            definition.options,
        );
    }

    public createTask(name: string, definition: TaskDefinition): vscode.Task {
        const execution = this.createExecution(definition);
        return createTask(name, execution, definition);
    }
}
