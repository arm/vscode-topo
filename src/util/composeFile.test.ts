import path from 'node:path';
import * as vscode from 'vscode';
import {
    compareComposeFiles,
    getComposeFile,
    getPreferredComposeFiles,
} from './composeFile';

describe('getComposeFile', () => {
    it('creates compose file metadata outside a workspace', () => {
        const uri = vscode.Uri.file('/fake/workspace/services/compose.yaml');

        const composeFile = getComposeFile(uri, undefined);

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

        const composeFile = getComposeFile(uri, workspaceFolder);

        expect(composeFile).toEqual({
            uri,
            relativePath: path.join('services', 'compose.yaml'),
            workspaceIndex: 1,
            workspaceName: 'beta',
        });
    });
});

describe('getPreferredComposeFiles', () => {
    it('keeps compose.yaml and compose.yml files from different directories', () => {
        const yamlFile = getComposeFile(
            vscode.Uri.file('/fake/workspace/compose.yaml'),
            undefined,
        );
        const ymlFile = getComposeFile(
            vscode.Uri.file('/fake/workspace/service/compose.yml'),
            undefined,
        );

        const composeFiles = getPreferredComposeFiles([yamlFile, ymlFile]);

        expect(composeFiles).toEqual([yamlFile, ymlFile]);
    });

    it('ignores compose.yml when compose.yaml is present in the same directory', () => {
        const yamlFile = getComposeFile(
            vscode.Uri.file('/fake/workspace/compose.yaml'),
            undefined,
        );
        const ymlFile = getComposeFile(
            vscode.Uri.file('/fake/workspace/compose.yml'),
            undefined,
        );

        const composeFiles = getPreferredComposeFiles([ymlFile, yamlFile]);

        expect(composeFiles).toEqual([yamlFile]);
    });
});

describe('compareComposeFiles', () => {
    const workspaceFolder: vscode.WorkspaceFolder = {
        uri: vscode.Uri.file('/fake/workspace'),
        name: 'workspace',
        index: 0,
    };

    it('sorts root files before nested files', () => {
        const nestedYaml = getComposeFile(
            vscode.Uri.file('/fake/workspace/services/compose.yaml'),
            workspaceFolder,
        );
        const rootYaml = getComposeFile(
            vscode.Uri.file('/fake/workspace/compose.yaml'),
            workspaceFolder,
        );
        const nestedYml = getComposeFile(
            vscode.Uri.file('/fake/workspace/a/compose.yml'),
            workspaceFolder,
        );

        const composeFiles = [nestedYaml, rootYaml, nestedYml].sort(
            compareComposeFiles,
        );

        expect(
            composeFiles.map((composeFile) => composeFile.relativePath),
        ).toEqual([
            'compose.yaml',
            path.join('a', 'compose.yml'),
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
        const alphaNested = getComposeFile(
            vscode.Uri.file('/fake/alpha/app/compose.yaml'),
            alphaWorkspace,
        );
        const betaRoot = getComposeFile(
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
