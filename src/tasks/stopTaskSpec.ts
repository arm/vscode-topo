import * as vscode from 'vscode';
import { TOPO_STOP_TASK_TYPE } from '../manifest';
import { COMPOSE_FILE_NAME } from '../util/composeFile';
import {
    createTopoComposeTaskCwd,
    resolveTopoComposeTaskDefinition,
    type TopoComposeTaskDefinition,
} from './topoComposeTask';
import type { TopoTaskSpec } from './topoTaskProvider';

export interface TopoStopTaskDefinition extends TopoComposeTaskDefinition {
    readonly type: typeof TOPO_STOP_TASK_TYPE;
}

export class StopTaskSpec implements TopoTaskSpec<TopoStopTaskDefinition> {
    public readonly type = TOPO_STOP_TASK_TYPE;

    public resolveDefinition(
        task: vscode.Task,
    ): TopoStopTaskDefinition | undefined {
        const definition = resolveTopoComposeTaskDefinition(task);
        return definition
            ? { ...definition, type: TOPO_STOP_TASK_TYPE }
            : undefined;
    }

    public createArgs(definition: TopoStopTaskDefinition): string[] {
        return [
            'stop',
            '--file',
            COMPOSE_FILE_NAME,
            '--target',
            definition.target,
        ];
    }

    public createCwd(definition: TopoStopTaskDefinition): string {
        return createTopoComposeTaskCwd(definition);
    }

    public createTaskName(definition: TopoStopTaskDefinition): string {
        return `Stop ${definition.composeFile} on ${definition.target}`;
    }
}
