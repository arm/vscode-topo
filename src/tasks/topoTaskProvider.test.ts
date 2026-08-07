import * as vscode from 'vscode';
import { TOPO_TASK_TYPE } from '../manifest';
import {
    TopoTaskProvider,
    type TopoTaskDefinition,
    type TopoTaskFactory,
} from './topoTaskProvider';

interface TestTaskDefinition extends TopoTaskDefinition {
    readonly command: 'test';
    readonly message: string;
}

interface OtherTaskDefinition extends TopoTaskDefinition {
    readonly command: 'other';
    readonly message: string;
}

const taskFactory: TopoTaskFactory<TestTaskDefinition> = {
    command: 'test',
    resolveDefinition: (task) => {
        const { message } = task.definition;
        return typeof message === 'string'
            ? { type: TOPO_TASK_TYPE, command: 'test', message }
            : undefined;
    },
    createExecution: (definition) =>
        new vscode.ProcessExecution('topo', [definition.message], {
            cwd: '/projects/test',
        }),
    createTask: (definition) =>
        new vscode.Task(
            definition,
            vscode.TaskScope.Workspace,
            `Test ${definition.message}`,
            'topo',
            new vscode.ProcessExecution('topo', [definition.message], {
                cwd: '/projects/test',
            }),
        ),
};

const otherTaskFactory: TopoTaskFactory<OtherTaskDefinition> = {
    command: 'other',
    resolveDefinition: (task) => {
        const { message } = task.definition;
        return typeof message === 'string'
            ? { type: TOPO_TASK_TYPE, command: 'other', message }
            : undefined;
    },
    createExecution: (definition) =>
        new vscode.ProcessExecution('topo', [definition.command]),
    createTask: (definition) =>
        new vscode.Task(
            definition,
            vscode.TaskScope.Workspace,
            `Other ${definition.message}`,
            'topo',
        ),
};

describe('TopoTaskProvider', () => {
    let taskProvider: TopoTaskProvider;

    const createConfiguredTask = (
        definition: vscode.TaskDefinition = {
            type: TOPO_TASK_TYPE,
            command: 'test',
            message: 'hello',
        },
    ): vscode.Task =>
        new vscode.Task(definition, vscode.TaskScope.Workspace, 'Test', 'topo');

    beforeEach(() => {
        taskProvider = new TopoTaskProvider([taskFactory, otherTaskFactory]);
    });

    it('does not provide detected tasks', () => {
        const providedTasks = taskProvider.provideTasks();

        expect(providedTasks).toEqual([]);
    });

    it('resolves a supported configured task', () => {
        const configuredTask = createConfiguredTask();

        const resolvedTask = taskProvider.resolveTask(configuredTask);

        expect(resolvedTask?.execution).toMatchObject({
            process: 'topo',
            args: ['hello'],
            options: { cwd: '/projects/test' },
        });
        expect(resolvedTask).not.toBe(configuredTask);
        expect(resolvedTask?.definition).toBe(configuredTask.definition);
        expect(configuredTask.execution).toBeUndefined();
    });

    it('does not resolve unsupported task types', () => {
        const configuredTask = createConfiguredTask({
            type: 'other',
            command: 'test',
            message: 'hello',
        });

        const resolvedTask = taskProvider.resolveTask(configuredTask);

        expect(resolvedTask).toBeUndefined();
    });

    it('does not resolve unsupported commands', () => {
        const configuredTask = createConfiguredTask({
            type: TOPO_TASK_TYPE,
            command: 'unsupported',
            message: 'hello',
        });

        const resolvedTask = taskProvider.resolveTask(configuredTask);

        expect(resolvedTask).toBeUndefined();
    });

    it('dispatches configured tasks by command', () => {
        const configuredTask = createConfiguredTask({
            type: TOPO_TASK_TYPE,
            command: 'other',
            message: 'hello',
        });

        const resolvedTask = taskProvider.resolveTask(configuredTask);

        expect(resolvedTask?.execution).toMatchObject({
            process: 'topo',
            args: ['other'],
        });
    });

    it('does not resolve invalid task definitions', () => {
        const configuredTask = createConfiguredTask({
            type: TOPO_TASK_TYPE,
            command: 'test',
        });

        const resolvedTask = taskProvider.resolveTask(configuredTask);

        expect(resolvedTask).toBeUndefined();
    });
});
