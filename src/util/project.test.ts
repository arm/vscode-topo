import path from 'node:path';
import * as vscode from 'vscode';
import { mutable } from './mutable';
import { findTopLevelComposeProjects } from './project';

describe('findTopLevelComposeProjects', () => {
    const workspaceFolder: vscode.WorkspaceFolder = {
        uri: vscode.Uri.file('/fake/workspace'),
        name: 'workspace',
        index: 0,
    };
    const workspacePath = workspaceFolder.uri.fsPath;

    beforeEach(() => {
        mutable(vscode.workspace).workspaceFolders = [workspaceFolder];
        mockComposeFiles();
        vi.mocked(vscode.workspace.getWorkspaceFolder).mockImplementation(
            () => workspaceFolder,
        );
    });

    afterEach(() => {
        vi.resetAllMocks();
        mutable(vscode.workspace).workspaceFolders = undefined;
    });

    function getRelativePatternBasePath(
        pattern: vscode.RelativePattern,
    ): string {
        const base = pattern.base as
            | string
            | vscode.Uri
            | vscode.WorkspaceFolder;
        if (typeof base === 'string') {
            return base;
        }

        if ('uri' in base) {
            return base.uri.fsPath;
        }

        return base.fsPath;
    }

    function getRelativePatternPattern(
        pattern: vscode.RelativePattern,
    ): string {
        return String(
            (pattern as vscode.RelativePattern & { pattern: string }).pattern,
        );
    }

    function matchesComposePattern(
        filePath: string,
        workspacePath: string,
        pattern: string,
    ): boolean {
        const relativePath = path
            .relative(workspacePath, filePath)
            .split(path.sep)
            .join('/');

        switch (pattern) {
            case 'compose.{yaml,yml}':
                return /^compose\.ya?ml$/.test(relativePath);
            case '*/compose.{yaml,yml}':
                return /^[^/]+\/compose\.ya?ml$/.test(relativePath);
            case '**/compose.{yaml,yml}':
                return /(^|\/)compose\.ya?ml$/.test(relativePath);
            default:
                return false;
        }
    }

    function mockComposeFiles(...paths: string[]): void {
        vi.mocked(vscode.workspace.findFiles).mockImplementation(
            async (pattern) => {
                const workspacePath =
                    pattern instanceof vscode.RelativePattern
                        ? getRelativePatternBasePath(pattern)
                        : '';
                const glob =
                    pattern instanceof vscode.RelativePattern
                        ? getRelativePatternPattern(pattern)
                        : String(pattern);

                return paths
                    .filter(
                        (filePath) =>
                            filePath.startsWith(workspacePath) &&
                            matchesComposePattern(
                                filePath,
                                workspacePath,
                                glob,
                            ),
                    )
                    .map((filePath) => vscode.Uri.file(filePath));
            },
        );
    }

    function workspaceFilePath(...segments: string[]): string {
        return vscode.Uri.joinPath(workspaceFolder.uri, ...segments).fsPath;
    }

    it('returns workspace folders with compose files at the root', async () => {
        const composeFilePath = workspaceFilePath('compose.yaml');
        mockComposeFiles(composeFilePath);

        const projects = await findTopLevelComposeProjects();

        expect(
            projects.map((project) => ({
                name: project.name,
                uri: project.uri.fsPath,
                composeFileUri: project.composeFileUri.fsPath,
            })),
        ).toEqual([
            {
                name: 'workspace',
                uri: workspacePath,
                composeFileUri: composeFilePath,
            },
        ]);
        expect(vi.mocked(vscode.workspace.findFiles)).toHaveBeenCalledWith(
            new vscode.RelativePattern(workspaceFolder, 'compose.{yaml,yml}'),
        );
        expect(vi.mocked(vscode.workspace.findFiles)).toHaveBeenCalledTimes(1);
    });

    it('returns compose files in child folders as separate projects', async () => {
        const projectPath = workspaceFilePath('demo');
        const composeFilePath = workspaceFilePath('demo', 'compose.yaml');
        mockComposeFiles(composeFilePath);

        const projects = await findTopLevelComposeProjects();

        expect(
            projects.map((project) => ({
                name: project.name,
                uri: project.uri.fsPath,
                composeFileUri: project.composeFileUri.fsPath,
            })),
        ).toEqual([
            {
                name: 'demo',
                uri: projectPath,
                composeFileUri: composeFilePath,
            },
        ]);
        expect(vi.mocked(vscode.workspace.findFiles)).toHaveBeenCalledWith(
            new vscode.RelativePattern(workspaceFolder, '*/compose.{yaml,yml}'),
        );
    });

    it('prefers compose.yaml over compose.yml in the workspace root', async () => {
        const composeYamlPath = workspaceFilePath('compose.yaml');
        mockComposeFiles(workspaceFilePath('compose.yml'), composeYamlPath);

        const projects = await findTopLevelComposeProjects();

        expect(projects).toHaveLength(1);
        expect(projects[0].composeFileUri.fsPath).toBe(composeYamlPath);
    });

    it('ignores compose files below immediate child folders', async () => {
        mockComposeFiles(workspaceFilePath('demo', 'nested', 'compose.yaml'));

        const projects = await findTopLevelComposeProjects();

        expect(projects).toEqual([]);
    });

    it('does not return child projects when the workspace root has a compose file', async () => {
        mockComposeFiles(
            workspaceFilePath('compose.yaml'),
            workspaceFilePath('demo', 'compose.yaml'),
        );

        const projects = await findTopLevelComposeProjects();

        expect(projects.map((project) => project.name)).toEqual(['workspace']);
        expect(vi.mocked(vscode.workspace.findFiles)).toHaveBeenCalledTimes(1);
    });

    it('sorts projects within each workspace folder', async () => {
        const secondWorkspaceFolder: vscode.WorkspaceFolder = {
            uri: vscode.Uri.file('/fake/other-workspace'),
            name: 'other-workspace',
            index: 1,
        };
        const secondWorkspaceComposeFilePath = vscode.Uri.joinPath(
            secondWorkspaceFolder.uri,
            'compose.yaml',
        ).fsPath;
        mutable(vscode.workspace).workspaceFolders = [
            workspaceFolder,
            secondWorkspaceFolder,
        ];
        mockComposeFiles(
            workspaceFilePath('compose.yaml'),
            secondWorkspaceComposeFilePath,
        );

        const projects = await findTopLevelComposeProjects();

        expect(projects.map((project) => project.name)).toEqual([
            'workspace',
            'other-workspace',
        ]);
    });
});
