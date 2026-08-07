import path from 'node:path';
import * as vscode from 'vscode';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { TopoCli } from '../services/topoCli';
import { mutable } from '../util/test/mutable';
import { TaskExecutor } from '../util/taskExecutor';
import {
    createTopoComposeTask,
    createTopoComposeTaskCwd,
    resolveTopoComposeTaskDefinition,
    type TopoComposeTaskDefinition,
} from './topoComposeTask';
import { TopoTaskProvider } from './topoTaskProvider';

describe('Topo compose tasks', () => {
    const workspaceFolder: vscode.WorkspaceFolder = {
        uri: vscode.Uri.file('/fake/workspace'),
        name: 'workspace',
        index: 0,
    };
    const target = 'topo.local';
    const taskType = 'topo.test';
    const topoBinaryPath = '/extension/resources/topo';
    const createTestTaskArgs = (
        definition: TopoComposeTaskDefinition,
    ): string[] => ['test', '--target', definition.target];
    const taskSpec = {
        type: taskType,
        resolveDefinition: (
            task: vscode.Task,
        ): TopoComposeTaskDefinition | undefined =>
            resolveTopoComposeTaskDefinition(task),
        createCwd: createTopoComposeTaskCwd,
        createTaskName: (definition: TopoComposeTaskDefinition): string =>
            `Test ${definition.composeFile} on ${definition.target}`,
        createArgs: createTestTaskArgs,
    };
    let topoCli: MockProxy<TopoCli>;
    let taskExecutor: TaskExecutor;
    let taskProvider: TopoTaskProvider<TopoComposeTaskDefinition>;

    const createConfiguredTask = (
        composeFile = '/projects/camera/compose.yaml',
    ): vscode.Task =>
        new vscode.Task(
            { type: taskType, composeFile, target },
            vscode.TaskScope.Workspace,
            'Test camera',
            'topo',
        );

    beforeEach(() => {
        topoCli = mock<TopoCli>();
        topoCli.getBinaryPath.mockReturnValue(topoBinaryPath);
        taskExecutor = new TaskExecutor(topoCli);
        taskProvider = new TopoTaskProvider(taskExecutor, taskSpec);
        mutable(vscode.workspace).workspaceFolders = [workspaceFolder];
    });

    afterEach(() => {
        mutable(vscode.workspace).workspaceFolders = undefined;
        vi.resetAllMocks();
    });

    it('rejects unsupported compose file names', () => {
        expect(() =>
            createTopoComposeTask(taskSpec, {
                type: taskType,
                target,
                composeFile: '/projects/camera/compose.yml',
            }),
        ).toThrow(
            'Unsupported compose file "compose.yml". Only compose.yaml is supported.',
        );
    });

    it('preserves resolved definition properties when creating a task', () => {
        const definition = {
            type: taskType,
            target,
            composeFile: '/projects/camera/compose.yaml',
            additionalProperty: 'preserved',
        };

        const task = createTopoComposeTask(taskSpec, definition);

        expect(task.definition).toEqual(definition);
    });

    it('resolves a configured nested task', () => {
        const definition: vscode.TaskDefinition = {
            type: taskType,
            composeFile: 'services/camera/compose.yaml',
            target,
            additionalProperty: 'preserved',
        };
        const configuredTask = new vscode.Task(
            definition,
            workspaceFolder,
            'Test camera',
            'topo',
        );
        configuredTask.presentationOptions = {
            reveal: vscode.TaskRevealKind.Silent,
        };

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

        const resolvedTask = taskProvider.resolveTask(configuredTask);

        expect(resolvedTask?.definition).toBe(definition);
        expect(resolvedTask).toMatchObject({
            scope: workspaceFolder,
            name: 'Test camera',
            presentationOptions: {
                reveal: vscode.TaskRevealKind.Silent,
            },
            execution: {
                process: topoBinaryPath,
                args: ['test', '--target', target],
                options: {
                    cwd: path.resolve(
                        workspaceFolder.uri.fsPath,
                        'services',
                        'camera',
                    ),
                },
            },
        });
    });

    it('rejects unsupported compose file names when resolving a task', () => {
        const configuredTask = createConfiguredTask(
            '/projects/camera/compose.yml',
        );

        expect(() => taskProvider.resolveTask(configuredTask)).toThrow(
            'Unsupported compose file "compose.yml". Only compose.yaml is supported.',
        );
    });

    it('does not resolve a relative compose path with ambiguous workspace scope', () => {
        mutable(vscode.workspace).workspaceFolders = [
            workspaceFolder,
            {
                uri: vscode.Uri.file('/fake/other'),
                name: 'other',
                index: 1,
            },
        ];
        const configuredTask = new vscode.Task(
            {
                type: taskType,
                composeFile: 'compose.yaml',
                target,
            },
            vscode.TaskScope.Workspace,
            'Test',
            'topo',
        );

        const resolvedTask = taskProvider.resolveTask(configuredTask);

        expect(resolvedTask).toBeUndefined();
    });

    it.each([
        {
            property: 'compose file',
            definition: { type: taskType, composeFile: '', target },
        },
        {
            property: 'target',
            definition: { type: taskType, composeFile: 'compose.yaml' },
        },
    ])(
        'does not resolve a task without a valid $property',
        ({ definition }) => {
            const configuredTask = new vscode.Task(
                definition,
                workspaceFolder,
                'Test',
                'topo',
            );

            const resolvedTask = taskProvider.resolveTask(configuredTask);

            expect(resolvedTask).toBeUndefined();
        },
    );
});
