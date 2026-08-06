import { TOPO_DEPLOY_TASK_TYPE } from './topoDeployTask';
import { TOPO_STOP_TASK_TYPE } from './topoStopTask';
import { TopoTaskFactory } from './topoTaskFactory';

describe('TopoTaskFactory', () => {
    const target = 'topo.local';
    const composeFilePath = '/projects/camera/compose.yaml';
    let taskFactory: TopoTaskFactory;

    beforeEach(() => {
        taskFactory = new TopoTaskFactory();
    });

    it('creates a stop task', () => {
        const task = taskFactory.createTask({
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

    it('creates a deploy task with empty deploy settings', () => {
        const task = taskFactory.createTask({
            type: TOPO_DEPLOY_TASK_TYPE,
            target,
            composeFilePath,
            settings: {},
        });

        expect(task).toMatchObject({
            definition: {
                type: 'topo.deploy',
                composeFilePath,
                target,
                settings: {},
            },
            name: `Deploy ${composeFilePath} to ${target}`,
            execution: {
                process: 'topo',
                args: ['deploy', '--file', 'compose.yaml', '--target', target],
                options: { cwd: '/projects/camera' },
            },
        });
    });

    it.each([
        {
            option: 'registry port',
            settings: { port: 5000 },
            expectedArgs: ['-p', '5000'],
        },
        {
            option: 'force recreate',
            settings: { forceRecreate: true },
            expectedArgs: ['--force-recreate'],
        },
        {
            option: 'no recreate',
            settings: { noRecreate: true },
            expectedArgs: ['--no-recreate'],
        },
    ])('adds arguments for $option', ({ settings, expectedArgs }) => {
        const task = taskFactory.createTask({
            type: TOPO_DEPLOY_TASK_TYPE,
            target,
            composeFilePath,
            settings,
        });

        expect(task).toMatchObject({
            execution: {
                args: [
                    'deploy',
                    '--file',
                    'compose.yaml',
                    '--target',
                    target,
                    ...expectedArgs,
                ],
            },
        });
    });
});
