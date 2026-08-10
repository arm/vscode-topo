import path from 'node:path';
import * as vscode from 'vscode';
import { TOPO_TASK_TYPE } from '../manifest';
import { mutable } from '../util/test/mutable';
import {
    createTopoComposeTaskCwd,
    resolveTopoComposeTaskDefinition,
} from './topoComposeTask';

describe('Topo compose tasks', () => {
    const workspaceFolder: vscode.WorkspaceFolder = {
        uri: vscode.Uri.file('/fake/workspace'),
        name: 'workspace',
        index: 0,
    };
    const target = 'topo.local';

    const createConfiguredTask = (
        definition: vscode.TaskDefinition,
        scope: vscode.TaskScope | vscode.WorkspaceFolder = workspaceFolder,
    ): vscode.Task => new vscode.Task(definition, scope, 'Test camera', 'topo');

    beforeEach(() => {
        mutable(vscode.workspace).workspaceFolders = [workspaceFolder];
    });

    afterEach(() => {
        mutable(vscode.workspace).workspaceFolders = undefined;
        vi.resetAllMocks();
    });

    it('derives the working directory from the compose file', () => {
        const cwd = createTopoComposeTaskCwd({
            type: TOPO_TASK_TYPE,
            command: 'test',
            composeFile: '/projects/camera/compose.yaml',
            target,
        });

        expect(cwd).toBe(path.dirname('/projects/camera/compose.yaml'));
    });

    it('resolves a compose path relative to the task workspace', () => {
        const definition: vscode.TaskDefinition = {
            type: TOPO_TASK_TYPE,
            command: 'test',
            composeFile: 'services/camera/compose.yaml',
            target,
            additionalProperty: 'preserved',
        };
        const configuredTask = createConfiguredTask(definition);

        const resolvedDefinition =
            resolveTopoComposeTaskDefinition(configuredTask);

        expect(resolvedDefinition).toEqual({
            ...definition,
            composeFile: path.resolve(
                workspaceFolder.uri.fsPath,
                'services',
                'camera',
                'compose.yaml',
            ),
        });
    });

    it('uses the only workspace for a workspace-scoped relative path', () => {
        const configuredTask = createConfiguredTask(
            {
                type: TOPO_TASK_TYPE,
                command: 'test',
                composeFile: 'compose.yaml',
                target,
            },
            vscode.TaskScope.Workspace,
        );

        const resolvedDefinition =
            resolveTopoComposeTaskDefinition(configuredTask);

        expect(resolvedDefinition?.composeFile).toBe(
            path.resolve(workspaceFolder.uri.fsPath, 'compose.yaml'),
        );
    });

    it('rejects an unsupported compose file name', () => {
        const configuredTask = createConfiguredTask({
            type: TOPO_TASK_TYPE,
            command: 'test',
            composeFile: 'compose.yml',
            target,
        });

        expect(() => resolveTopoComposeTaskDefinition(configuredTask)).toThrow(
            'Unsupported compose file "compose.yml". Only compose.yaml is supported.',
        );
    });

    it('does not resolve an ambiguously scoped relative path', () => {
        mutable(vscode.workspace).workspaceFolders = [
            workspaceFolder,
            {
                uri: vscode.Uri.file('/fake/other'),
                name: 'other',
                index: 1,
            },
        ];
        const configuredTask = createConfiguredTask(
            {
                type: TOPO_TASK_TYPE,
                command: 'test',
                composeFile: 'compose.yaml',
                target,
            },
            vscode.TaskScope.Workspace,
        );

        const resolvedDefinition =
            resolveTopoComposeTaskDefinition(configuredTask);

        expect(resolvedDefinition).toBeUndefined();
    });

    it.each([
        {
            property: 'compose file',
            definition: {
                type: TOPO_TASK_TYPE,
                command: 'test',
                composeFile: '',
                target,
            },
        },
        {
            property: 'target',
            definition: {
                type: TOPO_TASK_TYPE,
                command: 'test',
                composeFile: 'compose.yaml',
            },
        },
    ])(
        'does not resolve a task without a valid $property',
        ({ definition }) => {
            const configuredTask = createConfiguredTask(definition);

            const resolvedDefinition =
                resolveTopoComposeTaskDefinition(configuredTask);

            expect(resolvedDefinition).toBeUndefined();
        },
    );
});
