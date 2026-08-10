import path from 'node:path';
import * as vscode from 'vscode';
import { assertComposeFilePath } from '../util/composeFile';

export interface ComposeTaskDefinition extends vscode.TaskDefinition {
    readonly composeFile: string;
    readonly target: string;
}

export const createComposeTaskCwd = (
    definition: ComposeTaskDefinition,
): string => {
    assertComposeFilePath(definition.composeFile);
    return path.dirname(definition.composeFile);
};

export const resolveComposeTaskDefinition = (
    task: vscode.Task,
): ComposeTaskDefinition | undefined => {
    const { composeFile, target } = task.definition;
    if (isMissingOrEmptyString(composeFile) || isMissingOrEmptyString(target)) {
        return undefined;
    }

    const workspaceFolder = getTaskWorkspaceFolder(task);
    const resolvedComposeFile = resolveComposeFilePath(
        composeFile,
        workspaceFolder,
    );
    if (!resolvedComposeFile) {
        return undefined;
    }

    assertComposeFilePath(resolvedComposeFile);

    return {
        ...task.definition,
        composeFile: resolvedComposeFile,
        target,
    };
};

const getTaskWorkspaceFolder = (
    task: vscode.Task,
): vscode.WorkspaceFolder | undefined => {
    if (typeof task.scope === 'object') {
        return task.scope;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
    return workspaceFolders.length === 1 ? workspaceFolders[0] : undefined;
};

const resolveComposeFilePath = (
    composeFile: string,
    workspaceFolder: vscode.WorkspaceFolder | undefined,
): string | undefined => {
    if (path.isAbsolute(composeFile)) {
        return composeFile;
    }
    if (!workspaceFolder) {
        return undefined;
    }

    return path.resolve(workspaceFolder.uri.fsPath, composeFile);
};

const isMissingOrEmptyString = (value: unknown): boolean => {
    return typeof value !== 'string' || value.trim().length === 0;
};
