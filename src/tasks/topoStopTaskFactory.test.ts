import { TopoStopTaskFactory } from './topoStopTaskFactory';

describe('TopoStopTaskFactory', () => {
    const target = 'topo.local';
    const composeFilePath = '/projects/camera/compose.yaml';
    let stopTaskFactory: TopoStopTaskFactory;

    beforeEach(() => {
        stopTaskFactory = new TopoStopTaskFactory();
    });

    it('creates a stop task', () => {
        const task = stopTaskFactory.createTask({
            target,
            composeFilePath,
        });

        expect(task).toMatchObject({
            definition: {
                type: stopTaskFactory.type,
                composeFile: composeFilePath,
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
