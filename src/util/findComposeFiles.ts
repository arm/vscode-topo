import path from 'node:path';
import * as vscode from 'vscode';

export interface ComposeFile {
    uri: vscode.Uri;
    relativePath: string;
    workspaceIndex: number;
    workspaceName?: string;
}

export async function findComposeFiles(): Promise<ComposeFile[]> {
    const composeFiles = await vscode.workspace.findFiles(
        '**/compose.{yaml,yml}',
    );
    const composeFileDescriptions = composeFiles.map(getComposeFile);
    const preferredComposeFiles = getPreferredComposeFiles(
        composeFileDescriptions,
    );

    return preferredComposeFiles.sort(compareComposeFiles);
}

function getComposeFile(uri: vscode.Uri): ComposeFile {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
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

function compareComposeFiles(a: ComposeFile, b: ComposeFile): number {
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

function getPreferredComposeFiles(composeFiles: ComposeFile[]): ComposeFile[] {
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
    if (!composeFile.workspaceName) {
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
