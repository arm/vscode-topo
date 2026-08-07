import * as vscode from 'vscode';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { TaskExecutor } from '../util/taskExecutor';
import { TopoTaskProvider, type TopoTaskSpec } from './topoTaskProvider';

interface TestTaskDefinition extends vscode.TaskDefinition {
    readonly type: 'topo.test';
    readonly message: string;
}

const taskSpec: TopoTaskSpec<TestTaskDefinition> = {
    type: 'topo.test',
    resolveDefinition: (task) => {
        const { message } = task.definition;
        return typeof message === 'string'
            ? { type: 'topo.test', message }
            : undefined;
    },
    createArgs: (definition) => [definition.message],
    createCwd: () => '/projects/test',
    createTaskName: (definition) => `Test ${definition.message}`,
};

describe('TopoTaskProvider', () => {
    let taskExecutor: MockProxy<TaskExecutor>;
    let taskProvider: TopoTaskProvider<TestTaskDefinition>;

    const createConfiguredTask = (
        definition: vscode.TaskDefinition = {
            type: 'topo.test',
            message: 'hello',
        },
    ): vscode.Task =>
        new vscode.Task(definition, vscode.TaskScope.Workspace, 'Test', 'topo');

    beforeEach(() => {
        taskExecutor = mock<TaskExecutor>();
        taskExecutor.resolveProcessTaskBinary.mockImplementation(
            (task) => task,
        );
        taskProvider = new TopoTaskProvider(taskExecutor, taskSpec);
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
        expect(taskExecutor.resolveProcessTaskBinary).toHaveBeenCalledWith(
            configuredTask,
        );
    });

    it('does not resolve unsupported task types', () => {
        const configuredTask = createConfiguredTask({
            type: 'other',
            message: 'hello',
        });

        const resolvedTask = taskProvider.resolveTask(configuredTask);

        expect(resolvedTask).toBeUndefined();
        expect(taskExecutor.resolveProcessTaskBinary).not.toHaveBeenCalled();
    });

    it('does not resolve invalid task definitions', () => {
        const configuredTask = createConfiguredTask({ type: 'topo.test' });

        const resolvedTask = taskProvider.resolveTask(configuredTask);

        expect(resolvedTask).toBeUndefined();
        expect(taskExecutor.resolveProcessTaskBinary).not.toHaveBeenCalled();
    });
});
