import { COMPOSE_FILE_NAME } from '../util/composeFile';
import type { TopoComposeTaskInvocation } from './topoComposeTask';

export type TopoStopTaskInvocation = TopoComposeTaskInvocation;

export const topoStopTaskSpec = {
    createTaskName: (composeFilePath: string, target: string): string =>
        `Stop ${composeFilePath} on ${target}`,
    createArgs: (invocation: TopoStopTaskInvocation): string[] => [
        'stop',
        '--file',
        COMPOSE_FILE_NAME,
        '--target',
        invocation.target,
    ],
};
