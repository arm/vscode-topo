import * as vscode from 'vscode';
import { TOPO_STOP_TASK_COMMAND, TOPO_TASK_TYPE } from '../manifest';
import type { TopoCli } from '../services/topoCli';
import { COMPOSE_FILE_NAME } from '../util/composeFile';
import { createTask } from '../util/task';
import {
    createTopoComposeTaskCwd,
    resolveTopoComposeTaskDefinition,
    type TopoComposeTaskDefinition,
} from './topoComposeTask';
import type { TopoTaskDefinition, TopoTaskFactory } from './topoTaskProvider';

export type TopoStopTaskDefinition = TopoComposeTaskDefinition &
    TopoTaskDefinition & {
        readonly command: typeof TOPO_STOP_TASK_COMMAND;
    };

export class StopTaskFactory implements TopoTaskFactory<TopoStopTaskDefinition> {
    public readonly command = TOPO_STOP_TASK_COMMAND;

    constructor(private readonly topoCli: TopoCli) {}

    public resolveDefinition(
        task: vscode.Task,
    ): TopoStopTaskDefinition | undefined {
        const definition = resolveTopoComposeTaskDefinition(task);
        return definition
            ? {
                  ...definition,
                  type: TOPO_TASK_TYPE,
                  command: TOPO_STOP_TASK_COMMAND,
              }
            : undefined;
    }

    public createExecution(
        definition: TopoStopTaskDefinition,
    ): vscode.ProcessExecution {
        return new vscode.ProcessExecution(
            this.topoCli.getBinaryPath(),
            [
                'stop',
                '--file',
                COMPOSE_FILE_NAME,
                '--target',
                definition.target,
            ],
            { cwd: createTopoComposeTaskCwd(definition) },
        );
    }

    public createTask(definition: TopoStopTaskDefinition): vscode.Task {
        const execution = this.createExecution(definition);
        return createTask(
            `Stop ${definition.composeFile} on ${definition.target}`,
            execution,
            { cwd: execution.options?.cwd, definition },
        );
    }
}
