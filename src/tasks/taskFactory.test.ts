import os from 'node:os';
import * as vscode from 'vscode';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { contributes } from '../../package.json';
import { TOPO_TASK_TYPE } from '../manifest';
import { TopoCli } from '../services/topoCli';
import { mutable } from '../util/test/mutable';
import {
    resolveTaskDefinition,
    TaskCommand,
    TaskFactory,
    type TaskDefinition,
} from './taskFactory';

describe('TaskFactory', () => {
    const topoBinaryPath = '/extension/resources/topo';
    const definition: TaskDefinition = {
        type: TOPO_TASK_TYPE,
        command: TaskCommand.Configure,
        args: ['GREETING=Hello'],
        options: {
            cwd: '/projects/welcome',
            env: { GREETING_STYLE: 'enthusiastic' },
        },
    };
    let topoCli: MockProxy<TopoCli>;
    let taskFactory: TaskFactory;

    beforeEach(() => {
        vi.clearAllMocks();
        mutable(vscode.workspace).workspaceFolders = undefined;
        vi.mocked(vscode.workspace.getWorkspaceFolder).mockReturnValue(
            undefined,
        );
        topoCli = mock<TopoCli>();
        topoCli.getBinaryPath.mockReturnValue(topoBinaryPath);
        taskFactory = new TaskFactory(topoCli);
    });

    it('resolves a supported command', () => {
        const resolved = resolveTaskDefinition(definition);

        expect(resolved).toBe(definition);
    });

    it('keeps the manifest command enum in sync', () => {
        expect(contributes.taskDefinitions[0].properties.command.enum).toEqual(
            Object.values(TaskCommand),
        );
    });

    it.each([
        { type: 'other', command: 'deploy', args: [] },
        { type: TOPO_TASK_TYPE, command: 'deploy', args: 'invalid' },
        { type: TOPO_TASK_TYPE, command: 'deploy', args: [1] },
        { type: TOPO_TASK_TYPE, command: 'clone', args: [] },
    ])('does not resolve an invalid definition %#', (invalidDefinition) => {
        expect(resolveTaskDefinition(invalidDefinition)).toBeUndefined();
    });

    it('creates an execution using the bundled Topo CLI', () => {
        const execution = taskFactory.createExecution(definition);

        expect(execution).toMatchObject({
            process: topoBinaryPath,
            args: ['configure', 'GREETING=Hello'],
            options: {
                cwd: '/projects/welcome',
                env: { GREETING_STYLE: 'enthusiastic' },
            },
        });
    });

    it('creates a process task using the bundled Topo CLI', () => {
        const task = taskFactory.createProcessTask('Clone project', [
            'topo',
            'clone',
            'git:https://example.com/project.git',
        ]);

        expect(task.execution).toMatchObject({
            process: topoBinaryPath,
            args: ['clone', 'git:https://example.com/project.git'],
        });
    });

    it('leaves non-Topo process task commands unchanged', () => {
        const task = taskFactory.createProcessTask('List containers', [
            'docker',
            'ps',
        ]);

        expect(task.execution).toMatchObject({
            process: 'docker',
            args: ['ps'],
        });
    });

    it('uses the user home directory when no workspace or cwd is available', () => {
        const task = taskFactory.createProcessTask('Fix Debugger', [
            'topo',
            'install',
        ]);

        expect(task.execution).toMatchObject({
            options: { cwd: os.homedir() },
        });
    });

    it('uses the task workspace as the default working directory', () => {
        const execution = taskFactory.createExecution({
            type: TOPO_TASK_TYPE,
            command: TaskCommand.Projects,
            args: [],
        });

        expect(execution.options).toBeUndefined();
    });

    it('creates a named task from a generic definition', () => {
        const task = taskFactory.createTask('Configure welcome', definition);

        expect(task).toMatchObject({
            definition,
            name: 'Configure welcome',
            source: 'topo',
        });
        expect(task.execution).toBeDefined();
    });
});
