import * as vscode from 'vscode';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { TOPO_STOP_TASK_COMMAND, TOPO_TASK_TYPE } from '../manifest';
import { TopoCli } from '../services/topoCli';
import { StopTaskFactory } from './stopTaskFactory';

describe('Topo stop task', () => {
    const topoBinaryPath = '/extension/resources/topo';
    let topoCli: MockProxy<TopoCli>;
    let taskFactory: StopTaskFactory;

    beforeEach(() => {
        topoCli = mock<TopoCli>();
        topoCli.getBinaryPath.mockReturnValue(topoBinaryPath);
        taskFactory = new StopTaskFactory(topoCli);
    });

    it('creates a stop execution from a configured task', () => {
        const configuredTask = new vscode.Task(
            {
                type: TOPO_TASK_TYPE,
                command: TOPO_STOP_TASK_COMMAND,
                composeFile: '/projects/camera/compose.yaml',
                target: 'topo.local',
            },
            vscode.TaskScope.Workspace,
            'Stop camera',
            'topo',
        );

        const definition = taskFactory.resolveDefinition(configuredTask);
        if (!definition) {
            throw new Error('Expected the stop task definition to resolve');
        }
        const execution = taskFactory.createExecution(definition);

        expect(execution).toMatchObject({
            process: topoBinaryPath,
            args: ['stop', '--file', 'compose.yaml', '--target', 'topo.local'],
            options: { cwd: '/projects/camera' },
        });
    });
});
