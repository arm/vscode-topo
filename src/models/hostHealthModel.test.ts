import { HostHealthModel } from './hostHealthModel';
import { HostHealthCheckResult } from '../topoCliSchema';

const hostHealth: HostHealthCheckResult = {
    host: {
        dependencies: [
            {
                name: 'Container Engine',
                status: 'ok',
                value: 'docker',
            },
        ],
    },
};

describe('HostHealthModel', () => {
    it('defaults to an empty host dependency list', async () => {
        const model = new HostHealthModel();

        await expect(model.health).resolves.toEqual({
            host: {
                dependencies: [],
            },
        });
    });

    it('stores the latest host health promise', async () => {
        const model = new HostHealthModel();
        const healthPromise = Promise.resolve(hostHealth);

        model.health = healthPromise;

        expect(model.health).toBe(healthPromise);
        await expect(model.health).resolves.toBe(hostHealth);
    });

    it('fires onChanged when host health is updated', () => {
        const model = new HostHealthModel();
        const onChanged = jest.fn();
        model.onChanged(onChanged);

        model.health = Promise.resolve(hostHealth);

        expect(onChanged).toHaveBeenCalledTimes(1);
    });
});
