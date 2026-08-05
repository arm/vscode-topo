import path from 'node:path';
import * as vscode from 'vscode';
import { assertComposeFilePath } from '../util/composeFile';
import { createProcessTask } from '../util/task';

export interface TopoComposeTaskDefinition extends vscode.TaskDefinition {
    readonly composeFilePath: string;
    readonly target: string;
}

interface TopoComposeTaskSpec<TDefinition extends TopoComposeTaskDefinition> {
    createArgs(definition: TDefinition): string[];
    createTaskName(composeFilePath: string, target: string): string;
}

export const createTopoComposeTask = <
    TDefinition extends TopoComposeTaskDefinition,
>(
    taskSpec: TopoComposeTaskSpec<TDefinition>,
    definition: TDefinition,
): vscode.Task => {
    const { target, composeFilePath } = definition;
    assertComposeFilePath(composeFilePath);
    const taskName = taskSpec.createTaskName(composeFilePath, target);
    const command = ['topo', ...taskSpec.createArgs(definition)];
    const cwd = path.dirname(composeFilePath);

    return createProcessTask(taskName, command, { cwd, definition });
};
