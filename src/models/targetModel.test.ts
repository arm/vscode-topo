import { TargetModel } from './targetModel';

describe('TargetModel', () => {
    it('defaults to no selected target and an empty target list', () => {
        const model = new TargetModel();

        expect(model.selected).toBeUndefined();
        expect(model.targets).toEqual([]);
        expect(model.dataIssue).toBe(false);
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

    it('stores whether there is a data issue', () => {
        const model = new TargetModel();

        model.setDataIssue(true);

        expect(model.dataIssue).toBe(true);
    });

    it('clears targets and selected target when a data issue is set', () => {
        const model = new TargetModel();
        const onTargetsChanged = vi.fn();
        const onSelectedChanged = vi.fn();
        model.setTargets(['user@host']);
        model.setSelected('user@host');
        model.onTargetsChanged(onTargetsChanged);
        model.onSelectedChanged(onSelectedChanged);

        model.setDataIssue(true);

        expect(model.dataIssue).toBe(true);
        expect(model.targets).toEqual([]);
        expect(model.selected).toBeUndefined();
        expect(onTargetsChanged).toHaveBeenCalledTimes(1);
        expect(onSelectedChanged).toHaveBeenCalledTimes(1);
    });

    it('clears the data issue when targets are updated', () => {
        const model = new TargetModel();
        const onDataIssueChanged = vi.fn();
        model.setDataIssue(true);
        model.onDataIssueChanged(onDataIssueChanged);

        model.setTargets(['user@host']);

        expect(model.dataIssue).toBe(false);
        expect(onDataIssueChanged).toHaveBeenCalledTimes(1);
    });

    it('clears the data issue when selected target is updated', () => {
        const model = new TargetModel();
        const onDataIssueChanged = vi.fn();
        model.setDataIssue(true);
        model.onDataIssueChanged(onDataIssueChanged);

        model.setSelected('user@host');

        expect(model.dataIssue).toBe(false);
        expect(onDataIssueChanged).toHaveBeenCalledTimes(1);
    });

    it('fires onDataIssueChanged when data issue is updated', () => {
        const model = new TargetModel();
        const onChanged = vi.fn();
        model.onDataIssueChanged(onChanged);

        model.setDataIssue(true);
        model.setDataIssue(false);

        expect(model.dataIssue).toBe(false);
        expect(onChanged).toHaveBeenCalledTimes(2);
    });
});
