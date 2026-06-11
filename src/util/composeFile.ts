import path from 'node:path';
import * as vscode from 'vscode';

export interface ComposeFileMetadata {
    uri: vscode.Uri;
    relativePath: string;
    workspaceIndex: number;
    workspaceName?: string;
}

export const COMPOSE_FILE_GLOB = '**/compose.{yaml,yml}';

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

/**
 * Returns the compose files to show to users, preferring compose.yaml over
 * compose.yml when both exist in the same directory.
 *
 * Files in different directories or workspace folders are kept independently.
 */
export function getPreferredComposeFiles(
    composeFiles: ComposeFileMetadata[],
): ComposeFileMetadata[] {
    const yamlDirectories = new Set(
        composeFiles
            .filter((composeFile) => isYamlFile(composeFile))
            .map((composeFile) => getDirectoryKey(composeFile)),
    );

    return composeFiles.filter(
        (composeFile) =>
            isYamlFile(composeFile) ||
            !yamlDirectories.has(getDirectoryKey(composeFile)),
    );
}

function getDirectoryKey(composeFile: ComposeFileMetadata): string {
    if (composeFile.workspaceName === undefined) {
        return `file:${path.dirname(composeFile.uri.fsPath)}`;
    }
    return `${composeFile.workspaceIndex}:${path.dirname(composeFile.relativePath)}`;
}

function getRootPriority(composeFile: ComposeFileMetadata): number {
    const isWorkspaceRootFile = path.dirname(composeFile.relativePath) === '.';
    return isWorkspaceRootFile ? 0 : 1;
}

function isYamlFile(composeFile: ComposeFileMetadata): boolean {
    return path.extname(composeFile.uri.fsPath) === '.yaml';
}
