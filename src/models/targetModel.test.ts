import { TargetHealthCheck } from '../topoCliSchema';
import { ContainerItem, TargetDescription } from '../util/types';
import { loaded } from '../util/loadable';
import { TargetModel } from './targetModel';

const targetHealth: TargetHealthCheck = {
    destination: 'ssh://target',
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

const targetDescription: TargetDescription = {
    hostProcessors: [],
    remoteProcessors: [{ name: 'imx-rproc' }],
    totalMemoryKb: 1024,
};

describe('TargetModel', () => {
    it('defaults to no selected target, an empty target list and empty selected target data', () => {
        const model = new TargetModel();

        expect(model.selected).toBeUndefined();
        expect(model.targets).toEqual([]);
        expect(model.selectedTargetHealth).toEqual(loaded(undefined));
        expect(model.selectedTargetContainers).toEqual(loaded([]));
        expect(model.selectedTargetDescription).toEqual(loaded(undefined));
    });

    it('stores the latest selected target', () => {
        const model = new TargetModel();

        model.setSelected('user@host-a');
        model.setSelected('user@host-b');

        expect(model.selected).toBe('user@host-b');
    });

    it('clears the selected target', () => {
        const model = new TargetModel();
        const onChanged = vi.fn();
        model.onSelectedChanged(onChanged);

        model.setSelected('user@host');
        model.setSelected(undefined);

        expect(model.selected).toBeUndefined();
        expect(onChanged).toHaveBeenCalledTimes(2);
    });

    it('stores the latest target list', () => {
        const model = new TargetModel();
        const targets = ['user@host-a', 'user@host-b'];

        model.setTargets(['stale@host']);
        model.setTargets(targets);

        expect(model.targets).toBe(targets);
    });

    it('fires onSelectedChanged when selected target is updated', () => {
        const model = new TargetModel();
        const onChanged = vi.fn();
        model.onSelectedChanged(onChanged);

        model.setSelected('user@host');

        expect(onChanged).toHaveBeenCalledTimes(1);
    });

    it('clears the targets', () => {
        const model = new TargetModel();
        const onChanged = vi.fn();
        model.onTargetsChanged(onChanged);

        model.setTargets(['user@host']);
        model.setTargets([]);

        expect(model.targets).toEqual([]);
        expect(onChanged).toHaveBeenCalledTimes(2);
    });

    it('fires onTargetsChanged when targets are updated', () => {
        const model = new TargetModel();
        const onChanged = vi.fn();
        model.onTargetsChanged(onChanged);

        model.setTargets(['user@host']);

        expect(onChanged).toHaveBeenCalledTimes(1);
    });

    it('stores selected target data and fires change events', () => {
        const model = new TargetModel();
        const health = loaded(targetHealth);
        const containerState = loaded(containers);
        const descriptionState = loaded(targetDescription);
        const onHealthChanged = vi.fn();
        const onContainersChanged = vi.fn();
        const onDescriptionChanged = vi.fn();
        model.onHealthChanged(onHealthChanged);
        model.onContainersChanged(onContainersChanged);
        model.onDescriptionChanged(onDescriptionChanged);

        model.setSelectedTargetHealth(health);
        model.setSelectedTargetContainers(containerState);
        model.setSelectedTargetDescription(descriptionState);

        expect(model.selectedTargetHealth).toBe(health);
        expect(model.selectedTargetContainers).toBe(containerState);
        expect(model.selectedTargetDescription).toBe(descriptionState);
        expect(onHealthChanged).toHaveBeenCalledTimes(1);
        expect(onContainersChanged).toHaveBeenCalledTimes(1);
        expect(onDescriptionChanged).toHaveBeenCalledTimes(1);
    });

    it('clears selected target data when selected target is changed', () => {
        const model = new TargetModel();
        model.setSelectedTargetHealth(loaded(targetHealth));
        model.setSelectedTargetContainers(loaded(containers));
        model.setSelectedTargetDescription(loaded(targetDescription));

        model.setSelected('user@host');

        expect(model.selectedTargetHealth).toEqual(loaded(undefined));
        expect(model.selectedTargetContainers).toEqual(loaded([]));
        expect(model.selectedTargetDescription).toEqual(loaded(undefined));
    });
});
