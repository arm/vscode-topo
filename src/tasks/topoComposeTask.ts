import path from 'node:path';
import * as vscode from 'vscode';
import { assertComposeFilePath } from '../util/composeFile';
import { createProcessTask } from '../util/task';

export interface TopoComposeTaskInvocation {
    target: string;
    composeFilePath: string;
}

interface TopoComposeTaskSpec<TInvocation extends TopoComposeTaskInvocation> {
    readonly type: string;
    createArgs(invocation: TInvocation): string[];
    createTaskName(composeFile: string, target: string): string;
}

export const createTopoComposeTask = <
    TInvocation extends TopoComposeTaskInvocation,
>(
    taskSpec: TopoComposeTaskSpec<TInvocation>,
    invocation: TInvocation,
): vscode.Task => {
    const { target, composeFilePath } = invocation;
    assertComposeFilePath(composeFilePath);
    const taskName = taskSpec.createTaskName(composeFilePath, target);
    const command = ['topo', ...taskSpec.createArgs(invocation)];
    const cwd = path.dirname(composeFilePath);
    const definition = {
        type: taskSpec.type,
        composeFile: composeFilePath,
        target,
    };

    return createProcessTask(taskName, command, { cwd, definition });
};
