import * as vscode from 'vscode';
import { PACKAGE_NAME } from '../manifest';
import { COMPOSE_FILE_NAME } from '../util/composeFile';
import {
    createTopoComposeTask,
    type TopoComposeTaskInvocation,
} from './topoComposeTask';

export class TopoStopTaskProvider {
    public readonly type = `${PACKAGE_NAME}.stop`;
    private readonly taskSpec = {
        type: this.type,
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

    public createTask(invocation: TopoComposeTaskInvocation): vscode.Task {
        return createTopoComposeTask(this.taskSpec, invocation);
    }
}
