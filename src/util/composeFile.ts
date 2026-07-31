import path from 'node:path';
import * as vscode from 'vscode';

export interface ComposeFileMetadata {
    uri: vscode.Uri;
    relativePath: string;
    workspaceIndex: number;
    workspaceName?: string;
}

export const COMPOSE_FILE_NAME = 'compose.yaml';
export const COMPOSE_FILE_GLOB = `**/${COMPOSE_FILE_NAME}`;

export function assertComposeFilePath(composeFilePath: string): void {
    const composeFileName = path.basename(composeFilePath);
    if (composeFileName !== COMPOSE_FILE_NAME) {
        throw new Error(
            `Unsupported compose file "${composeFileName}". Only ${COMPOSE_FILE_NAME} is supported.`,
        );
    }
}

export function getComposeFileMetadata(
    uri: vscode.Uri,
    workspaceFolder: vscode.WorkspaceFolder | undefined,
): ComposeFileMetadata {
    if (!workspaceFolder) {
        return {
            uri,
            relativePath: path.basename(uri.fsPath),
            workspaceIndex: Number.MAX_SAFE_INTEGER,
        };
    }

    return {
        uri,
        relativePath: path.relative(workspaceFolder.uri.fsPath, uri.fsPath),
        workspaceIndex: workspaceFolder.index,
        workspaceName: workspaceFolder.name,
    };
}

export function compareComposeFiles(
    a: ComposeFileMetadata,
    b: ComposeFileMetadata,
): number {
    const rootDiff = getRootPriority(a) - getRootPriority(b);
    if (rootDiff !== 0) {
        return rootDiff;
    }

    const workspaceDiff = a.workspaceIndex - b.workspaceIndex;
    if (workspaceDiff !== 0) {
        return workspaceDiff;
    }

    return a.relativePath.localeCompare(b.relativePath);
}

export async function findComposeFiles(
    workspaceFolder: vscode.WorkspaceFolder,
    glob: string,
): Promise<ComposeFileMetadata[]> {
    const composeFileUris = await vscode.workspace.findFiles(
        new vscode.RelativePattern(workspaceFolder, glob),
    );

    return composeFileUris
        .map((uri) => getComposeFileMetadata(uri, workspaceFolder))
        .sort(compareComposeFiles);
}

function getRootPriority(composeFile: ComposeFileMetadata): number {
    const isWorkspaceRootFile = path.dirname(composeFile.relativePath) === '.';
    return isWorkspaceRootFile ? 0 : 1;
}
