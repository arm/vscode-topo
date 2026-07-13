import path from 'node:path';
import * as vscode from 'vscode';

export interface ComposeFileMetadata {
    uri: vscode.Uri;
    relativePath: string;
    workspaceIndex: number;
    workspaceName?: string;
}

type ComposeFileQuickPickItem = vscode.QuickPickItem & {
    uri: vscode.Uri;
};

export const COMPOSE_FILE_GLOB = '**/*compose*.{yaml,yml}';

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

export async function selectComposeFile(
    composeFileUris: readonly vscode.Uri[],
    placeHolder: string,
): Promise<vscode.Uri | undefined> {
    if (composeFileUris.length <= 1) {
        return composeFileUris[0];
    }

    const items: ComposeFileQuickPickItem[] = composeFileUris.map((uri) => ({
        label: path.basename(uri.fsPath),
        uri,
    }));
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder,
    });

    return selected?.uri;
}

function getRootPriority(composeFile: ComposeFileMetadata): number {
    const isWorkspaceRootFile = path.dirname(composeFile.relativePath) === '.';
    return isWorkspaceRootFile ? 0 : 1;
}
