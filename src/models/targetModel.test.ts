import { TargetModel } from './targetModel';

describe('TargetModel', () => {
    it('defaults to no selected target and an empty target list', () => {
        const model = new TargetModel();

        expect(model.selected).toBeUndefined();
        expect(model.targets).toEqual([]);
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
});
