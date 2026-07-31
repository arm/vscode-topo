import path from 'node:path';
import * as vscode from 'vscode';
import {
    assertComposeFilePath,
    compareComposeFiles,
    findComposeFiles,
    getComposeFileMetadata,
} from './composeFile';

describe('assertComposeFilePath', () => {
    it('accepts compose.yaml', () => {
        expect(() =>
            assertComposeFilePath('/fake/workspace/compose.yaml'),
        ).not.toThrow();
    });

    it('rejects compose.yml', () => {
        expect(() =>
            assertComposeFilePath('/fake/workspace/compose.yml'),
        ).toThrow(
            'Unsupported compose file "compose.yml". Only compose.yaml is supported.',
        );
    });
});

describe('getComposeFileMetadata', () => {
    it('creates compose file metadata outside a workspace', () => {
        const uri = vscode.Uri.file('/fake/workspace/services/compose.yaml');

        const composeFile = getComposeFileMetadata(uri, undefined);

        expect(composeFile).toEqual({
            uri,
            relativePath: 'compose.yaml',
            workspaceIndex: Number.MAX_SAFE_INTEGER,
        });
    });

    it('includes workspace metadata for compose files', () => {
        const workspaceFolder: vscode.WorkspaceFolder = {
            uri: vscode.Uri.file('/fake/beta'),
            name: 'beta',
            index: 1,
        };
        const uri = vscode.Uri.file('/fake/beta/services/compose.yaml');

        const composeFile = getComposeFileMetadata(uri, workspaceFolder);

        expect(composeFile).toEqual({
            uri,
            relativePath: path.join('services', 'compose.yaml'),
            workspaceIndex: 1,
            workspaceName: 'beta',
        });
    });
});

describe('findComposeFiles', () => {
    afterEach(() => {
        vi.resetAllMocks();
    });

    it('finds compose.yaml files in a workspace folder sorted by metadata', async () => {
        const workspaceFolder: vscode.WorkspaceFolder = {
            uri: vscode.Uri.file('/fake/workspace'),
            name: 'workspace',
            index: 0,
        };
        const rootComposeFile = vscode.Uri.file('/fake/workspace/compose.yaml');
        const childYamlFile = vscode.Uri.file(
            '/fake/workspace/service/compose.yaml',
        );
        vi.mocked(vscode.workspace.findFiles).mockResolvedValueOnce([
            childYamlFile,
            rootComposeFile,
        ]);

        const composeFiles = await findComposeFiles(
            workspaceFolder,
            '**/compose.yaml',
        );

        expect(vscode.workspace.findFiles).toHaveBeenCalledWith(
            new vscode.RelativePattern(workspaceFolder, '**/compose.yaml'),
        );
        expect(
            composeFiles.map((composeFile) => composeFile.relativePath),
        ).toEqual(['compose.yaml', path.join('service', 'compose.yaml')]);
    });
});

describe('compareComposeFiles', () => {
    const workspaceFolder: vscode.WorkspaceFolder = {
        uri: vscode.Uri.file('/fake/workspace'),
        name: 'workspace',
        index: 0,
    };

    it('sorts root files before nested files', () => {
        const nestedYaml = getComposeFileMetadata(
            vscode.Uri.file('/fake/workspace/services/compose.yaml'),
            workspaceFolder,
        );
        const rootYaml = getComposeFileMetadata(
            vscode.Uri.file('/fake/workspace/compose.yaml'),
            workspaceFolder,
        );
        const otherNestedYaml = getComposeFileMetadata(
            vscode.Uri.file('/fake/workspace/a/compose.yaml'),
            workspaceFolder,
        );

        const composeFiles = [nestedYaml, rootYaml, otherNestedYaml].sort(
            compareComposeFiles,
        );

        expect(
            composeFiles.map((composeFile) => composeFile.relativePath),
        ).toEqual([
            'compose.yaml',
            path.join('a', 'compose.yaml'),
            path.join('services', 'compose.yaml'),
        ]);
    });

    it('sorts root files before nested files across workspaces', () => {
        const alphaWorkspace: vscode.WorkspaceFolder = {
            uri: vscode.Uri.file('/fake/alpha'),
            name: 'alpha',
            index: 0,
        };
        const betaWorkspace: vscode.WorkspaceFolder = {
            uri: vscode.Uri.file('/fake/beta'),
            name: 'beta',
            index: 1,
        };
        const alphaNested = getComposeFileMetadata(
            vscode.Uri.file('/fake/alpha/app/compose.yaml'),
            alphaWorkspace,
        );
        const betaRoot = getComposeFileMetadata(
            vscode.Uri.file('/fake/beta/compose.yaml'),
            betaWorkspace,
        );

        const composeFiles = [alphaNested, betaRoot].sort(compareComposeFiles);

        expect(composeFiles.map((composeFile) => composeFile.uri)).toEqual([
            betaRoot.uri,
            alphaNested.uri,
        ]);
    });
});
