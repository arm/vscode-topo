import { createTopoComposeTask } from './topoComposeTask';

describe('createTopoComposeTask', () => {
    const taskSpec = {
        createTaskName: (composeFilePath: string, target: string): string =>
            `Test ${composeFilePath} on ${target}`,
        createArgs: (): string[] => ['test'],
    };

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
