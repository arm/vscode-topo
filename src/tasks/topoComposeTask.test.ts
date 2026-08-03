import { createTopoComposeTask } from './topoComposeTask';

describe('createTopoComposeTask', () => {
    const taskSpec = {
        type: 'topo.test',
        createTaskName: (composeFile: string, target: string): string =>
            `Test ${composeFile} on ${target}`,
        createArgs: (): string[] => ['test'],
    };

    it('creates a compose task', () => {
        const task = createTopoComposeTask(taskSpec, {
            target: 'topo.local',
            composeFilePath: '/projects/camera/compose.yaml',
        });

        expect(task).toMatchObject({
            definition: {
                type: 'topo.test',
                composeFile: '/projects/camera/compose.yaml',
                target: 'topo.local',
            },
            name: 'Test /projects/camera/compose.yaml on topo.local',
            execution: {
                process: 'topo',
                args: ['test'],
                options: {
                    cwd: '/projects/camera',
                },
            },
        });
    });

    it('rejects unsupported compose file names', () => {
        expect(() =>
            createTopoComposeTask(taskSpec, {
                target: 'topo.local',
                composeFilePath: '/projects/camera/compose.yml',
            }),
        ).toThrow(
            'Unsupported compose file "compose.yml". Only compose.yaml is supported.',
        );
    });
});
