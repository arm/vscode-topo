import path from 'node:path';
import * as vscode from 'vscode';
import { assertComposeFilePath } from '../util/composeFile';
import { createProcessTask } from '../util/task';

export interface TopoComposeTaskInvocation {
    readonly composeFilePath: string;
    readonly target: string;
}

interface TopoComposeTaskSpec<TInvocation extends TopoComposeTaskInvocation> {
    createArgs(invocation: TInvocation): string[];
    createTaskName(composeFilePath: string, target: string): string;
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

    return createProcessTask(taskName, command, { cwd });
};
