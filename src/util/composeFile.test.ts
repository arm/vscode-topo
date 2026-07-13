import path from 'node:path';
import * as vscode from 'vscode';
import {
    compareComposeFiles,
    findComposeFiles,
    getComposeFileMetadata,
    selectComposeFile,
} from './composeFile';

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

    it('finds Compose files in a workspace folder sorted by metadata', async () => {
        const workspaceFolder: vscode.WorkspaceFolder = {
            uri: vscode.Uri.file('/fake/workspace'),
            name: 'workspace',
            index: 0,
        };
        const rootComposeFile = vscode.Uri.file('/fake/workspace/compose.yaml');
        const childYamlFile = vscode.Uri.file(
            '/fake/workspace/service/compose.yaml',
        );
        const childYmlFile = vscode.Uri.file(
            '/fake/workspace/service/compose.yml',
        );
        vi.mocked(vscode.workspace.findFiles).mockResolvedValueOnce([
            childYmlFile,
            childYamlFile,
            rootComposeFile,
        ]);

        const composeFiles = await findComposeFiles(
            workspaceFolder,
            '**/*compose*.{yaml,yml}',
        );

        expect(vscode.workspace.findFiles).toHaveBeenCalledWith(
            new vscode.RelativePattern(
                workspaceFolder,
                '**/*compose*.{yaml,yml}',
            ),
        );
        expect(
            composeFiles.map((composeFile) => composeFile.relativePath),
        ).toEqual([
            'compose.yaml',
            path.join('service', 'compose.yaml'),
            path.join('service', 'compose.yml'),
        ]);
    });

    it('includes all filenames returned by the Compose filename glob', async () => {
        const workspaceFolder: vscode.WorkspaceFolder = {
            uri: vscode.Uri.file('/fake/workspace'),
            name: 'workspace',
            index: 0,
        };
        const composeFile = vscode.Uri.file(
            '/fake/workspace/production-compose.yaml',
        );
        const workflowFile = vscode.Uri.file(
            '/fake/workspace/workflow-compose.yaml',
        );
        vi.mocked(vscode.workspace.findFiles).mockResolvedValueOnce([
            workflowFile,
            composeFile,
        ]);
        const composeFiles = await findComposeFiles(
            workspaceFolder,
            '**/*compose*.{yaml,yml}',
        );

        expect(composeFiles.map(({ uri }) => uri)).toEqual([
            composeFile,
            workflowFile,
        ]);
    });
});

describe('selectComposeFile', () => {
    afterEach(() => {
        vi.resetAllMocks();
    });

    it('returns the only Compose file without prompting', async () => {
        const composeFile = vscode.Uri.file('/fake/workspace/compose.yaml');

        const selected = await selectComposeFile(
            [composeFile],
            'Select a Compose file',
        );

        expect(selected).toBe(composeFile);
        expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
    });

    it('prompts when multiple Compose files are available', async () => {
        const composeFile = vscode.Uri.file('/fake/workspace/compose.yaml');
        const developmentFile = vscode.Uri.file(
            '/fake/workspace/compose-development.yaml',
        );
        const selectedComposeFile = {
            label: 'compose-development.yaml',
            uri: developmentFile,
        };
        vi.mocked(vscode.window.showQuickPick).mockResolvedValueOnce(
            selectedComposeFile,
        );

        const selected = await selectComposeFile(
            [composeFile, developmentFile],
            'Select a Compose file',
        );

        expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
            [
                { label: 'compose.yaml', uri: composeFile },
                {
                    label: 'compose-development.yaml',
                    uri: developmentFile,
                },
            ],
            { placeHolder: 'Select a Compose file' },
        );
        expect(selected).toBe(developmentFile);
    });

    it('returns undefined when Compose file selection is cancelled', async () => {
        const composeFiles = [
            vscode.Uri.file('/fake/workspace/compose.yaml'),
            vscode.Uri.file('/fake/workspace/compose-development.yaml'),
        ];
        vi.mocked(vscode.window.showQuickPick).mockResolvedValueOnce(undefined);

        const selected = await selectComposeFile(
            composeFiles,
            'Select a Compose file',
        );

        expect(selected).toBeUndefined();
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
        const nestedYml = getComposeFileMetadata(
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
