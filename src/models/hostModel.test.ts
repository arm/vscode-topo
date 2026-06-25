import { HostModel } from './hostModel';
import { HostHealthReport } from '../topoCliSchema';
import { loaded, unloaded } from '../util/loadable';

const hostHealth: HostHealthReport = {
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
    it('defaults to an unloaded state', async () => {
        const model = new HostModel();

        expect(model.health).toStrictEqual(unloaded());
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
