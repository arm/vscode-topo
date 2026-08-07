import * as vscode from 'vscode';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { TOPO_STOP_TASK_TYPE } from '../manifest';
import { TopoCli } from '../services/topoCli';
import {
    StopTaskFactory,
    type TopoStopTaskDefinition,
} from './stopTaskFactory';
import { TopoTaskProvider } from './topoTaskProvider';

describe('Topo stop task', () => {
    const topoBinaryPath = '/extension/resources/topo';
    let topoCli: MockProxy<TopoCli>;
    let taskProvider: TopoTaskProvider<TopoStopTaskDefinition>;

    beforeEach(() => {
        topoCli = mock<TopoCli>();
        topoCli.getBinaryPath.mockReturnValue(topoBinaryPath);
        taskProvider = new TopoTaskProvider(new StopTaskFactory(topoCli));
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
            process: topoBinaryPath,
            args: ['stop', '--file', 'compose.yaml', '--target', 'topo.local'],
            options: { cwd: '/projects/camera' },
        });
    });
});
