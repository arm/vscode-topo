import * as vscode from 'vscode';
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

export interface TaskDefinition extends vscode.TaskDefinition {
    readonly type: typeof TOPO_TASK_TYPE;
    readonly command: TaskCommand;
    readonly args: readonly string[];
    readonly cwd?: string;
}

export const resolveTaskDefinition = (
    definition: vscode.TaskDefinition,
): TaskDefinition | undefined => {
    const { type, command, args, cwd } = definition;
    if (
        type === TOPO_TASK_TYPE &&
        isTaskCommand(command) &&
        Array.isArray(args) &&
        args.every((arg) => typeof arg === 'string') &&
        (cwd === undefined || isValidString(cwd))
    ) {
        return definition as TaskDefinition;
    }

    return undefined;
};

export class TaskFactory {
    constructor(private readonly topoCli: TopoCli) {}

    public createExecution(
        definition: TaskDefinition,
    ): vscode.ProcessExecution {
        const options = definition.cwd ? { cwd: definition.cwd } : undefined;
        return new vscode.ProcessExecution(
            this.topoCli.getBinaryPath(),
            [definition.command, ...definition.args],
            options,
        );
    }

    public createTask(name: string, definition: TaskDefinition): vscode.Task {
        const execution = this.createExecution(definition);
        return createTask(name, execution, {
            cwd: definition.cwd,
            definition,
        });
    }
}

const isValidString = (value: unknown): value is string => {
    return typeof value === 'string' && value.trim().length > 0;
};

const isTaskCommand = (value: unknown): value is TaskCommand => {
    return Object.values(TaskCommand).includes(value as TaskCommand);
};
