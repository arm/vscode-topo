import { HostModel } from './hostModel';
import type { HostHealth } from '../util/healthReport';
import type { TopoSkillReport } from '../services/topoSkill';
import { loaded, unloaded } from '../util/loadable';

const hostHealth: HostHealth = { capabilities: [] };

describe('HostModel', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('represents an invalid engine as an errored state', () => {
        vi.stubEnv('TOPO_ENGINE', 'invalid');
        const model = new HostModel();

        expect(model.containerEngine).toMatchObject({
            status: 'errored',
            error: expect.any(Error),
        });
    });

    it('starts with the resolved engine and unloaded reports', () => {
        vi.stubEnv('TOPO_ENGINE', 'podman');
        const model = new HostModel();

        expect(model.containerEngine).toStrictEqual(loaded('podman'));
        expect(model.health).toStrictEqual(unloaded());
        expect(model.skillReport).toStrictEqual(unloaded());
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

    it('stores the skill report and fires onChanged', () => {
        const model = new HostModel();
        const onChanged = vi.fn();
        const skillReport = loaded<TopoSkillReport>({
            status: 'installed',
            agents: [],
        });
        model.onSkillReportChanged(onChanged);

        model.setSkillReport(skillReport);

        expect(model.skillReport).toBe(skillReport);
        expect(onChanged).toHaveBeenCalledTimes(1);
    });
});
