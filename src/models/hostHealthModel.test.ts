import { HostModel } from './hostModel';
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

describe('HostModel', () => {
    it('defaults to an empty host dependency list', async () => {
        const model = new HostModel();

        await expect(model.health).resolves.toEqual({
            host: {
                dependencies: [],
            },
        });
    });

    it('stores the latest host health promise', async () => {
        const model = new HostModel();
        const healthPromise = Promise.resolve(hostHealth);

        model.health = healthPromise;

        expect(model.health).toBe(healthPromise);
        await expect(model.health).resolves.toBe(hostHealth);
    });

    it('fires onChanged when host health is updated', () => {
        const model = new HostModel();
        const onChanged = jest.fn();
        model.onHealthChanged(onChanged);

        model.health = Promise.resolve(hostHealth);

        expect(onChanged).toHaveBeenCalledTimes(1);
    });
});
