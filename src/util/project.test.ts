import * as vscode from 'vscode';
import { mutable } from './mutable';
import { findTopLevelComposeProjects } from './project';

describe('findTopLevelComposeProjects', () => {
    const workspaceFolder: vscode.WorkspaceFolder = {
        uri: vscode.Uri.file('/fake/workspace'),
        name: 'workspace',
        index: 0,
    };

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

    function mockComposeFiles(...paths: string[]): void {
        vi.mocked(vscode.workspace.findFiles).mockImplementation(
            async (pattern) => {
                const workspacePath =
                    pattern instanceof vscode.RelativePattern
                        ? getRelativePatternBasePath(pattern)
                        : '';

                return paths
                    .filter((filePath) => filePath.startsWith(workspacePath))
                    .map((filePath) => vscode.Uri.file(filePath));
            },
        );
    }

    it('returns workspace folders with compose files at the root', async () => {
        mockComposeFiles('/fake/workspace/compose.yaml');

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
                uri: '/fake/workspace',
                composeFileUri: '/fake/workspace/compose.yaml',
            },
        ]);
        expect(vi.mocked(vscode.workspace.findFiles)).toHaveBeenCalledWith(
            new vscode.RelativePattern(
                workspaceFolder,
                '**/compose.{yaml,yml}',
            ),
        );
    });

    it('returns compose files in child folders as separate projects', async () => {
        mockComposeFiles('/fake/workspace/demo/compose.yaml');

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
                uri: '/fake/workspace/demo',
                composeFileUri: '/fake/workspace/demo/compose.yaml',
            },
        ]);
    });

    it('prefers compose.yaml over compose.yml in the workspace root', async () => {
        mockComposeFiles(
            '/fake/workspace/compose.yml',
            '/fake/workspace/compose.yaml',
        );

        const projects = await findTopLevelComposeProjects();

        expect(projects).toHaveLength(1);
        expect(projects[0].composeFileUri.fsPath).toBe(
            '/fake/workspace/compose.yaml',
        );
    });

    it('ignores compose files below immediate child folders', async () => {
        mockComposeFiles('/fake/workspace/demo/nested/compose.yaml');

        const projects = await findTopLevelComposeProjects();

        expect(projects).toEqual([]);
    });

    it('returns both root and nested compose projects in the same workspace', async () => {
        mockComposeFiles(
            '/fake/workspace/compose.yaml',
            '/fake/workspace/demo/compose.yaml',
        );

        const projects = await findTopLevelComposeProjects();

        expect(projects.map((project) => project.name)).toEqual([
            'demo',
            'workspace',
        ]);
    });

    it('sorts projects within each workspace folder', async () => {
        const secondWorkspaceFolder: vscode.WorkspaceFolder = {
            uri: vscode.Uri.file('/fake/other-workspace'),
            name: 'other-workspace',
            index: 1,
        };
        mutable(vscode.workspace).workspaceFolders = [
            workspaceFolder,
            secondWorkspaceFolder,
        ];
        mockComposeFiles(
            '/fake/workspace/compose.yaml',
            '/fake/other-workspace/compose.yaml',
        );

        const projects = await findTopLevelComposeProjects();

        expect(projects.map((project) => project.name)).toEqual([
            'workspace',
            'other-workspace',
        ]);
    });
});
