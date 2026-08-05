import { TopoDeployTaskProvider } from './topoDeployTaskProvider';

describe('TopoDeployTaskProvider', () => {
    const target = 'topo.local';
    const composeFilePath = '/projects/camera/compose.yaml';
    let deployTaskProvider: TopoDeployTaskProvider;

    beforeEach(() => {
        deployTaskProvider = new TopoDeployTaskProvider();
    });

    it('creates a deploy task with empty deploy settings', () => {
        const task = deployTaskProvider.createTask({
            target,
            composeFilePath,
            settings: {},
        });

        expect(task).toMatchObject({
            definition: {
                type: 'topo.deploy',
                composeFile: composeFilePath,
                target,
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
        const task = deployTaskProvider.createTask({
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
