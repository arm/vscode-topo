import { TargetHealthCheck } from '../topoCliSchema';
import { ContainerItem } from '../util/types';
import { loaded } from '../util/loadable';
import { SelectedTargetModel } from './selectedTargetModel';

const targetHealth: TargetHealthCheck = {
    isLocalhost: false,
    connectivity: {
        name: 'Connectivity',
        status: 'ok',
        value: 'connected',
    },
    subsystemDriver: {
        name: 'Subsystem Driver',
        status: 'ok',
        value: 'ready',
    },
    dependencies: [],
};

const containers: ContainerItem[] = [
    {
        id: 'container-id',
        name: 'service',
        image: 'image',
        state: 'running',
        status: 'Up 1 minute',
        labels: '',
        runningFor: '1 minute',
        createdAt: '',
        runtime: 'runc',
        annotations: {},
        ports: {},
        target: 'user@target',
    },
];

describe('SelectedTargetModel', () => {
    it('defaults to loaded empty selected target data', () => {
        const model = new SelectedTargetModel();

        expect(model.health).toEqual(loaded(undefined));
        expect(model.containers).toEqual(loaded([]));
    });

    it('stores health and containers and fires change events', () => {
        const model = new SelectedTargetModel();
        const health = loaded(targetHealth);
        const containerState = loaded(containers);
        const onHealthChanged = vi.fn();
        const onContainersChanged = vi.fn();
        model.onHealthChanged(onHealthChanged);
        model.onContainersChanged(onContainersChanged);

        model.setHealth(health);
        model.setContainers(containerState);

        expect(model.health).toBe(health);
        expect(model.containers).toBe(containerState);
        expect(onHealthChanged).toHaveBeenCalledTimes(1);
        expect(onContainersChanged).toHaveBeenCalledTimes(1);
    });

    it('clears health and containers to their default states', () => {
        const model = new SelectedTargetModel();
        const onHealthChanged = vi.fn();
        const onContainersChanged = vi.fn();
        model.setHealth(loaded(targetHealth));
        model.setContainers(loaded(containers));
        model.onHealthChanged(onHealthChanged);
        model.onContainersChanged(onContainersChanged);

        model.clear();

        expect(model.health).toEqual(loaded(undefined));
        expect(model.containers).toEqual(loaded([]));
        expect(onHealthChanged).toHaveBeenCalledTimes(1);
        expect(onContainersChanged).toHaveBeenCalledTimes(1);
    });
});
