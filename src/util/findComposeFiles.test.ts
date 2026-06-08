import path from 'node:path';
import * as vscode from 'vscode';
import { findComposeFiles } from './findComposeFiles';
import { mutable } from './mutable';

describe('findComposeFiles', () => {
    const workspaceUri = vscode.Uri.file('/fake/workspace');
    const workspaceFolders = [
        { uri: workspaceUri, name: 'workspace', index: 0 },
    ];

    function mockWorkspaceFolders(
        workspaceFolders: vscode.WorkspaceFolder[],
    ): void {
        mutable(vscode.workspace).workspaceFolders = workspaceFolders;
        vi.mocked(vscode.workspace.getWorkspaceFolder).mockImplementation(
            (uri) =>
                workspaceFolders.find((workspaceFolder) =>
                    uri.fsPath.startsWith(workspaceFolder.uri.fsPath),
                ),
        );
    }

    beforeEach(() => {
        vi.mocked(vscode.workspace.findFiles).mockReset();
        vi.mocked(vscode.workspace.findFiles).mockResolvedValue([]);
        vi.mocked(vscode.workspace.getWorkspaceFolder).mockReset();
        vi.mocked(vscode.workspace.getWorkspaceFolder).mockReturnValue(
            undefined,
        );
        mutable(vscode.workspace).workspaceFolders = undefined;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('finds compose.yaml and compose.yml files', async () => {
        const yamlFile = vscode.Uri.file('/fake/workspace/compose.yaml');
        const ymlFile = vscode.Uri.file('/fake/workspace/compose.yml');
        vi.mocked(vscode.workspace.findFiles).mockResolvedValueOnce([
            yamlFile,
            ymlFile,
        ]);

        const composeFiles = await findComposeFiles();

        expect(vscode.workspace.findFiles).toHaveBeenCalledWith(
            '**/compose.{yaml,yml}',
        );
        expect(composeFiles.map((composeFile) => composeFile.uri)).toEqual([
            yamlFile,
            ymlFile,
        ]);
    });

    it('sorts root files before nested files and yaml before yml', async () => {
        mockWorkspaceFolders(workspaceFolders);
        const nestedYaml = vscode.Uri.file(
            '/fake/workspace/services/compose.yaml',
        );
        const rootYaml = vscode.Uri.file('/fake/workspace/compose.yaml');
        const nestedYml = vscode.Uri.file('/fake/workspace/a/compose.yml');
        const rootYml = vscode.Uri.file('/fake/workspace/compose.yml');
        vi.mocked(vscode.workspace.findFiles).mockResolvedValueOnce([
            nestedYaml,
            rootYaml,
            nestedYml,
            rootYml,
        ]);

        const composeFiles = await findComposeFiles();

        expect(
            composeFiles.map((composeFile) => composeFile.relativePath),
        ).toEqual([
            'compose.yaml',
            'compose.yml',
            path.join('services', 'compose.yaml'),
            path.join('a', 'compose.yml'),
        ]);
    });

    it('includes workspace metadata for compose files', async () => {
        mockWorkspaceFolders([
            {
                uri: vscode.Uri.file('/fake/alpha'),
                name: 'alpha',
                index: 0,
            },
            { uri: vscode.Uri.file('/fake/beta'), name: 'beta', index: 1 },
        ]);
        const betaComposeFile = vscode.Uri.file(
            '/fake/beta/services/compose.yaml',
        );
        vi.mocked(vscode.workspace.findFiles).mockResolvedValueOnce([
            betaComposeFile,
        ]);

        const composeFiles = await findComposeFiles();

        expect(composeFiles).toEqual([
            {
                uri: betaComposeFile,
                relativePath: path.join('services', 'compose.yaml'),
                workspaceIndex: 1,
                workspaceName: 'beta',
            },
        ]);
    });
});
