import path from 'node:path';
import * as vscode from 'vscode';
import { createTask } from '../util/task';
import { mutable } from '../util/test/mutable';
import {
    createTopoComposeTaskCwd,
    resolveTopoComposeTaskDefinition,
    type TopoComposeTaskDefinition,
} from './topoComposeTask';
import { TopoTaskProvider, type TopoTaskFactory } from './topoTaskProvider';

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
    const createTestExecution = (
        definition: TopoComposeTaskDefinition,
    ): vscode.ProcessExecution =>
        new vscode.ProcessExecution(
            topoBinaryPath,
            createTestTaskArgs(definition),
            { cwd: createTopoComposeTaskCwd(definition) },
        );
    const createTestTask = (
        definition: TopoComposeTaskDefinition,
    ): vscode.Task => {
        const execution = createTestExecution(definition);
        return createTask(
            `Test ${definition.composeFile} on ${definition.target}`,
            execution,
            { cwd: execution.options?.cwd, definition },
        );
    };
    const taskFactory: TopoTaskFactory<TopoComposeTaskDefinition> = {
        type: taskType,
        resolveDefinition: (
            task: vscode.Task,
        ): TopoComposeTaskDefinition | undefined =>
            resolveTopoComposeTaskDefinition(task),
        createExecution: createTestExecution,
        createTask: createTestTask,
    };
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
        taskProvider = new TopoTaskProvider(taskFactory);
        mutable(vscode.workspace).workspaceFolders = [workspaceFolder];
    });

    afterEach(() => {
        mutable(vscode.workspace).workspaceFolders = undefined;
        vi.resetAllMocks();
    });

    it('rejects unsupported compose file names', () => {
        expect(() =>
            taskFactory.createTask({
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

        const task = taskFactory.createTask(definition);

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
