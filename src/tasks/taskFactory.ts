import * as vscode from 'vscode';
import os from 'node:os';
import { array, enums, is, literal, string, type } from 'superstruct';
import { TOPO_TASK_TYPE } from '../manifest';
import type { TopoCli } from '../services/topoCli';
import { createTask, shellQuote } from '../util/task';

export enum TaskCommand {
    Clone = 'clone',
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
    readonly options?: vscode.ShellExecutionOptions;
}

export const resolveTaskDefinition = (
    definition: vscode.TaskDefinition,
): TaskDefinition | undefined => {
    return is(definition, taskDefinitionSchema) ? definition : undefined;
};

export class TaskFactory {
    constructor(private readonly topoCli: TopoCli) {}

    public createShellTask(name: string, command: string[]): vscode.Task {
        const [executableName, ...args] = command;
        if (!executableName) {
            throw new Error('No command passed to task');
        }

        const executable =
            executableName === 'topo'
                ? this.topoCli.getBinaryPath()
                : shellQuote(executableName);
        const hasWorkspace =
            (vscode.workspace.workspaceFolders?.length ?? 0) > 0;
        const execution = new vscode.ShellExecution(
            executable,
            args.map(shellQuote),
            {
                cwd: hasWorkspace ? undefined : os.homedir(),
            },
        );
        return createTask(name, execution);
    }

    public createExecution(definition: TaskDefinition): vscode.ShellExecution {
        return new vscode.ShellExecution(
            this.topoCli.getBinaryPath(),
            [definition.command, ...definition.args.map(shellQuote)],
            definition.options,
        );
    }

    public createTask(name: string, definition: TaskDefinition): vscode.Task {
        const execution = this.createExecution(definition);
        return createTask(name, execution, definition);
    }
}
