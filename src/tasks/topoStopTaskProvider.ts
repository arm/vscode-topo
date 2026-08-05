import * as vscode from 'vscode';
import { PACKAGE_NAME } from '../manifest';
import { COMPOSE_FILE_NAME } from '../util/composeFile';
import {
    createTopoComposeTask,
    type TopoComposeTaskInvocation,
} from './topoComposeTask';

const taskType = `${PACKAGE_NAME}.stop`;
const taskSpec = {
    type: taskType,
    createTaskName: (composeFile: string, target: string): string =>
        `Stop ${composeFile} on ${target}`,
    createArgs: (invocation: TopoComposeTaskInvocation): string[] => [
        'stop',
        '--file',
        COMPOSE_FILE_NAME,
        '--target',
        invocation.target,
    ],
};

export class TopoStopTaskProvider {
    public createTask(invocation: TopoComposeTaskInvocation): vscode.Task {
        return createTopoComposeTask(taskSpec, invocation);
    }
}
