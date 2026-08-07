import * as vscode from 'vscode';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { TOPO_STOP_TASK_TYPE } from '../manifest';
import { TaskExecutor } from '../util/taskExecutor';
import { StopTaskSpec, type TopoStopTaskDefinition } from './stopTaskSpec';
import { TopoTaskProvider } from './topoTaskProvider';

describe('Topo stop task', () => {
    let taskExecutor: MockProxy<TaskExecutor>;
    let taskProvider: TopoTaskProvider<TopoStopTaskDefinition>;

    beforeEach(() => {
        taskExecutor = mock<TaskExecutor>();
        taskExecutor.resolveProcessTaskBinary.mockImplementation(
            (task) => task,
        );
        taskProvider = new TopoTaskProvider(taskExecutor, new StopTaskSpec());
    });

    it('resolves a configured stop task', () => {
        const configuredTask = new vscode.Task(
            {
                type: TOPO_STOP_TASK_TYPE,
                composeFile: '/projects/camera/compose.yaml',
                target: 'topo.local',
            },
            vscode.TaskScope.Workspace,
            'Stop camera',
            'topo',
        );

        const resolvedTask = taskProvider.resolveTask(configuredTask);

        expect(resolvedTask?.execution).toMatchObject({
            args: ['stop', '--file', 'compose.yaml', '--target', 'topo.local'],
            options: { cwd: '/projects/camera' },
        });
    });
});
