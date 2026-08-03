import { mock, type MockProxy } from 'vitest-mock-extended';
import { Config } from '../services/config';
import { TopoDeployTaskFactory } from './topoDeployTaskFactory';

describe('TopoDeployTaskFactory', () => {
    const target = 'topo.local';
    const composeFilePath = '/projects/camera/compose.yaml';
    let config: MockProxy<Config>;
    let deployTaskFactory: TopoDeployTaskFactory;

    beforeEach(() => {
        config = mock<Config>();
        config.getTargetSettings.mockReturnValue({});
        deployTaskFactory = new TopoDeployTaskFactory(config);
    });

    it('creates a deploy task with empty deploy settings', () => {
        const task = deployTaskFactory.createTask({
            target,
            composeFilePath,
        });

        expect(task).toMatchObject({
            definition: {
                type: deployTaskFactory.type,
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
        config.getTargetSettings.mockReturnValue({ deploy: settings });

        const task = deployTaskFactory.createTask({ target, composeFilePath });

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
