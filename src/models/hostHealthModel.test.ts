import { HostModel } from './hostModel';
import { HostHealthCheckResult } from '../topoCliSchema';
import { Loadable } from '../util/types';

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

        expect(model.health).toStrictEqual({
            status: 'loaded',
            data: {
                host: {
                    dependencies: [],
                },
            },
        });
    });

    it('stores the latest host health promise', async () => {
        const model = new HostModel();
        const healthLoadable: Loadable<HostHealthCheckResult> = {
            status: 'loaded',
            data: hostHealth,
        };

        model.setHealth(healthLoadable);

        expect(model.health).toBe(healthLoadable);
        expect(model.health).toStrictEqual({
            status: 'loaded',
            data: hostHealth,
        });
    });

    it('fires onChanged when host health is updated', () => {
        const model = new HostModel();
        const onChanged = vi.fn();
        model.onHealthChanged(onChanged);

        model.setHealth({ status: 'loaded', data: hostHealth });

        expect(onChanged).toHaveBeenCalledTimes(1);
    });
});
