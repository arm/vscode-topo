import path from 'node:path';
import * as vscode from 'vscode';
import {
    COMPOSE_FILE_GLOB,
    compareComposeFiles,
    getComposeFileMetadata,
    getPreferredComposeFiles,
} from './composeFile';

export interface ProjectMetadata {
    name: string;
    uri: vscode.Uri;
    composeFileUri: vscode.Uri;
    workspaceIndex: number;
    workspaceName: string;
}

export async function findTopLevelComposeProjects(): Promise<
    ProjectMetadata[]
> {
    const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
    const projects: ProjectMetadata[] = [];

    for (const workspaceFolder of workspaceFolders) {
        const composeFileUris = await findComposeFileUris(workspaceFolder);
        const composeFiles = getPreferredComposeFiles(
            composeFileUris.map((uri) =>
                getComposeFileMetadata(uri, workspaceFolder),
            ),
        ).sort(compareComposeFiles);

        projects.push(
            ...composeFiles.map((composeFile) =>
                createProjectMetadata(composeFile, workspaceFolder),
            ),
        );
    }

    return projects.sort(compareProjects);
}

async function findComposeFileUris(
    workspaceFolder: vscode.WorkspaceFolder,
): Promise<vscode.Uri[]> {
    const composeFileUris = await vscode.workspace.findFiles(
        new vscode.RelativePattern(workspaceFolder, COMPOSE_FILE_GLOB),
    );

    return composeFileUris.filter((uri) =>
        isTopLevelComposeFile(uri, workspaceFolder),
    );
}

function isTopLevelComposeFile(
    uri: vscode.Uri,
    workspaceFolder: vscode.WorkspaceFolder,
): boolean {
    const relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
    const directory = path.dirname(relativePath);

    return directory === '.' || path.dirname(directory) === '.';
}

function createProjectMetadata(
    composeFile: ReturnType<typeof getComposeFileMetadata>,
    workspaceFolder: vscode.WorkspaceFolder,
): ProjectMetadata {
    const projectPath = path.dirname(composeFile.uri.fsPath);

    return {
        name: getProjectName(composeFile, workspaceFolder),
        uri: vscode.Uri.file(projectPath),
        composeFileUri: composeFile.uri,
        workspaceIndex: workspaceFolder.index,
        workspaceName: workspaceFolder.name,
    };
}

function getProjectName(
    composeFile: ReturnType<typeof getComposeFileMetadata>,
    workspaceFolder: vscode.WorkspaceFolder,
): string {
    const relativeDirectory = path.dirname(composeFile.relativePath);
    if (relativeDirectory === '.') {
        return workspaceFolder.name;
    }

    return path.basename(relativeDirectory);
}

function compareProjects(a: ProjectMetadata, b: ProjectMetadata): number {
    const workspaceDiff = a.workspaceIndex - b.workspaceIndex;
    if (workspaceDiff !== 0) {
        return workspaceDiff;
    }

    const nameDiff = a.name.localeCompare(b.name, undefined, {
        sensitivity: 'base',
    });
    if (nameDiff !== 0) {
        return nameDiff;
    }

    return a.uri.fsPath.localeCompare(b.uri.fsPath);
}
