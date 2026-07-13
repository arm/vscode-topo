import path from 'node:path';
import * as vscode from 'vscode';
import { ComposeFileMetadata, findComposeFiles } from './composeFile';

const ROOT_COMPOSE_FILE_GLOB = '*compose*.{yaml,yml}';
const CHILD_COMPOSE_FILE_GLOB = '*/*compose*.{yaml,yml}';

export interface ProjectMetadata {
    name: string;
    uri: vscode.Uri;
    composeFileUris: vscode.Uri[];
    workspaceIndex: number;
    workspaceName: string;
}

export async function findTopLevelComposeProjects(
    workspaceFolders: readonly vscode.WorkspaceFolder[],
): Promise<ProjectMetadata[]> {
    const projects: ProjectMetadata[] = [];

    for (const workspaceFolder of workspaceFolders) {
        const composeFiles = await findProjectComposeFiles(workspaceFolder);

        projects.push(
            ...groupComposeFilesByDirectory(composeFiles).map(
                (directoryComposeFiles) =>
                    createProjectMetadata(
                        directoryComposeFiles,
                        workspaceFolder,
                    ),
            ),
        );
    }

    return projects.sort(compareProjects);
}

async function findProjectComposeFiles(
    workspaceFolder: vscode.WorkspaceFolder,
): Promise<ComposeFileMetadata[]> {
    const rootComposeFiles = await findComposeFiles(
        workspaceFolder,
        ROOT_COMPOSE_FILE_GLOB,
    );
    if (rootComposeFiles.length > 0) {
        return rootComposeFiles;
    }

    return findComposeFiles(workspaceFolder, CHILD_COMPOSE_FILE_GLOB);
}

function groupComposeFilesByDirectory(
    composeFiles: ComposeFileMetadata[],
): ComposeFileMetadata[][] {
    const composeFilesByDirectory = new Map<string, ComposeFileMetadata[]>();
    for (const composeFile of composeFiles) {
        const directory = path.dirname(composeFile.uri.fsPath);
        const directoryComposeFiles =
            composeFilesByDirectory.get(directory) ?? [];
        directoryComposeFiles.push(composeFile);
        composeFilesByDirectory.set(directory, directoryComposeFiles);
    }
    return [...composeFilesByDirectory.values()];
}

function createProjectMetadata(
    composeFiles: ComposeFileMetadata[],
    workspaceFolder: vscode.WorkspaceFolder,
): ProjectMetadata {
    const composeFile = composeFiles[0];
    const projectPath = path.dirname(composeFile.uri.fsPath);

    return {
        name: getProjectName(composeFile, workspaceFolder),
        uri: vscode.Uri.file(projectPath),
        composeFileUris: composeFiles.map(({ uri }) => uri),
        workspaceIndex: workspaceFolder.index,
        workspaceName: workspaceFolder.name,
    };
}

function getProjectName(
    composeFile: ComposeFileMetadata,
    workspaceFolder: vscode.WorkspaceFolder,
): string {
    const relativeDirectory = path.dirname(composeFile.relativePath);
    return relativeDirectory === '.'
        ? workspaceFolder.name
        : path.basename(relativeDirectory);
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
