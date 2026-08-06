import { PACKAGE_NAME } from '../manifest';
import { COMPOSE_FILE_NAME } from '../util/composeFile';
import type { TopoComposeTaskDefinition } from './topoComposeTask';

export const TOPO_STOP_TASK_TYPE = `${PACKAGE_NAME}.stop`;

export interface TopoStopTaskDefinition extends TopoComposeTaskDefinition {
    readonly type: typeof TOPO_STOP_TASK_TYPE;
}

export const topoStopTaskSpec = {
    createTaskName: (composeFilePath: string, target: string): string =>
        `Stop ${composeFilePath} on ${target}`,
    createArgs: (definition: TopoStopTaskDefinition): string[] => [
        'stop',
        '--file',
        COMPOSE_FILE_NAME,
        '--target',
        definition.target,
    ],
};
