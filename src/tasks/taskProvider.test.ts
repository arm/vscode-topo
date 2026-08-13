import * as vscode from 'vscode';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { TOPO_TASK_TYPE } from '../manifest';
import { TaskCommand, type TaskFactory } from './taskFactory';
import { TaskProvider } from './taskProvider';

describe('TaskProvider', () => {
    let taskFactory: MockProxy<TaskFactory>;
    let taskProvider: TaskProvider;

    const createConfiguredTask = (
        definition: vscode.TaskDefinition = {
            type: TOPO_TASK_TYPE,
            command: TaskCommand.Configure,
            args: ['GREETING=Hello'],
            options: {
                cwd: '/projects/welcome',
                env: { GREETING_STYLE: 'enthusiastic' },
            },
        },
    ): vscode.Task =>
        new vscode.Task(
            definition,
            vscode.TaskScope.Workspace,
            'Configure welcome',
            'topo',
        );

    beforeEach(() => {
        taskFactory = mock<TaskFactory>();
        taskProvider = new TaskProvider(taskFactory);
    });

    it('does not provide detected tasks', () => {
        expect(taskProvider.provideTasks()).toEqual([]);
    });

    it('resolves a supported configured command', () => {
        const configuredTask = createConfiguredTask();
        const execution = new vscode.ProcessExecution(
            '/extension/resources/topo',
            ['configure', 'GREETING=Hello'],
            {
                cwd: '/projects/welcome',
                env: { GREETING_STYLE: 'enthusiastic' },
            },
        );
        taskFactory.createExecution.mockReturnValue(execution);

        const resolvedTask = taskProvider.resolveTask(configuredTask);

        expect(taskFactory.createExecution).toHaveBeenCalledWith(
            configuredTask.definition,
        );
        expect(resolvedTask?.execution).toBe(execution);
        expect(resolvedTask?.definition).toBe(configuredTask.definition);
        expect(configuredTask.execution).toBeUndefined();
    });

    it('does not resolve an unsupported configured command', () => {
        const definition = {
            type: TOPO_TASK_TYPE,
            command: 'unsupported',
            args: [],
        };
        const resolvedTask = taskProvider.resolveTask(
            createConfiguredTask(definition),
        );

        expect(resolvedTask).toBeUndefined();
        expect(taskFactory.createExecution).not.toHaveBeenCalled();
    });
});
