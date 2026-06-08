import path from 'node:path';
import * as vscode from 'vscode';

export interface ComposeFile {
    uri: vscode.Uri;
    relativePath: string;
    workspaceIndex: number;
    workspaceName?: string;
}

export const COMPOSE_FILE_GLOB = '**/compose.{yaml,yml}';

export function getComposeFile(
    uri: vscode.Uri,
    workspaceFolder: vscode.WorkspaceFolder | undefined,
): ComposeFile {
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

export function compareComposeFiles(a: ComposeFile, b: ComposeFile): number {
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

export function getPreferredComposeFiles(
    composeFiles: ComposeFile[],
): ComposeFile[] {
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

function getDirectoryKey(composeFile: ComposeFile): string {
    if (composeFile.workspaceName === undefined) {
        return `file:${path.dirname(composeFile.uri.fsPath)}`;
    }
    return `${composeFile.workspaceIndex}:${path.dirname(composeFile.relativePath)}`;
}

function getRootPriority(composeFile: ComposeFile): number {
    const isWorkspaceRootFile = path.dirname(composeFile.relativePath) === '.';
    return isWorkspaceRootFile ? 0 : 1;
}

function isYamlFile(composeFile: ComposeFile): boolean {
    return path.extname(composeFile.uri.fsPath) === '.yaml';
}
