import {
    TOPO_STOP_TASK_TYPE,
    TopoStopTaskProvider,
} from './topoStopTaskProvider';

describe('TopoStopTaskProvider', () => {
    const target = 'topo.local';
    const composeFilePath = '/projects/camera/compose.yaml';
    let stopTaskProvider: TopoStopTaskProvider;

    beforeEach(() => {
        stopTaskProvider = new TopoStopTaskProvider();
    });

    it('creates a stop task', () => {
        const task = stopTaskProvider.createTask({
            type: TOPO_STOP_TASK_TYPE,
            target,
            composeFilePath,
        });

        expect(task).toMatchObject({
            definition: {
                type: 'topo.stop',
                composeFilePath,
                target,
            },
            name: `Stop ${composeFilePath} on ${target}`,
            execution: {
                process: 'topo',
                args: ['stop', '--file', 'compose.yaml', '--target', target],
                options: { cwd: '/projects/camera' },
            },
        });
    });
});
