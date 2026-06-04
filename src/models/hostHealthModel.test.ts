import { HostModel } from './hostModel';
import { HostHealthCheckResult } from '../topoCliSchema';
import { loaded } from '../util/loadable';

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

    it('stores the latest host health loadable', async () => {
        const model = new HostModel();
        const healthLoadable = loaded(hostHealth);

        model.setHealth(healthLoadable);

        expect(model.health).toBe(healthLoadable);
    });

    it('fires onChanged when host health is updated', () => {
        const model = new HostModel();
        const onChanged = vi.fn();
        model.onHealthChanged(onChanged);

        model.setHealth(loaded(hostHealth));

        expect(onChanged).toHaveBeenCalledTimes(1);
    });
});
