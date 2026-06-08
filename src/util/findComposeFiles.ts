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

    return composeFiles.map(getComposeFile).sort(compareComposeFiles);
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
    const priorityDiff = getComposeFilePriority(a) - getComposeFilePriority(b);
    if (priorityDiff !== 0) {
        return priorityDiff;
    }

    const workspaceDiff = a.workspaceIndex - b.workspaceIndex;
    if (workspaceDiff !== 0) {
        return workspaceDiff;
    }

    return a.relativePath.localeCompare(b.relativePath);
}

function getComposeFilePriority(composeFile: ComposeFile): number {
    const isYamlFile = path.extname(composeFile.uri.fsPath) === '.yaml';
    const isWorkspaceRootFile = path.dirname(composeFile.relativePath) === '.';
    if (isWorkspaceRootFile) {
        return isYamlFile ? 0 : 1;
    }
    return isYamlFile ? 2 : 3;
}
