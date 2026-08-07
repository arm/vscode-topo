import * as vscode from 'vscode';
import { TopoTaskProvider, type TopoTaskFactory } from './topoTaskProvider';

interface TestTaskDefinition extends vscode.TaskDefinition {
    readonly type: 'topo.test';
    readonly message: string;
}

const taskFactory: TopoTaskFactory<TestTaskDefinition> = {
    type: 'topo.test',
    resolveDefinition: (task) => {
        const { message } = task.definition;
        return typeof message === 'string'
            ? { type: 'topo.test', message }
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

describe('TopoTaskProvider', () => {
    let taskProvider: TopoTaskProvider<TestTaskDefinition>;

    const createConfiguredTask = (
        definition: vscode.TaskDefinition = {
            type: 'topo.test',
            message: 'hello',
        },
    ): vscode.Task =>
        new vscode.Task(definition, vscode.TaskScope.Workspace, 'Test', 'topo');

    beforeEach(() => {
        taskProvider = new TopoTaskProvider(taskFactory);
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
            message: 'hello',
        });

        const resolvedTask = taskProvider.resolveTask(configuredTask);

        expect(resolvedTask).toBeUndefined();
    });

    it('does not resolve invalid task definitions', () => {
        const configuredTask = createConfiguredTask({ type: 'topo.test' });

        const resolvedTask = taskProvider.resolveTask(configuredTask);

        expect(resolvedTask).toBeUndefined();
    });
});
