import { mock } from 'vitest-mock-extended';
import { HostModel } from '../models/hostModel';
import { TopoCli } from '../services/topoCli';
import { HostController } from './hostController';
import { HostHealthReport } from '../services/topoCliSchema';
import { TopoSkill } from '../services/topoSkill';
import { loaded } from '../util/loadable';

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

describe('HostController', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('refreshes host health and skill status on creation', async () => {
        const topoCli = mock<TopoCli>({
            hostHealth: vi.fn().mockResolvedValue(hostHealth),
        });
        const topoSkill = mock<TopoSkill>({
            getStatus: vi.fn().mockResolvedValue('installed'),
        });
        const model = new HostModel();

        new HostController(model, topoCli, topoSkill);
        await vi.waitFor(() => {
            expect(model.health).toStrictEqual(loaded(hostHealth));
            expect(model.skillStatus).toStrictEqual(loaded('installed'));
        });

        expect(topoCli.hostHealth).toHaveBeenCalled();
        expect(topoSkill.getStatus).toHaveBeenCalled();
    });

    it('refreshes host health and skill status on command', async () => {
        const topoCli = mock<TopoCli>({
            hostHealth: vi.fn().mockResolvedValue(hostHealth),
        });
        const topoSkill = mock<TopoSkill>({
            getStatus: vi.fn().mockResolvedValue('missing'),
        });
        const model = new HostModel();
        const controller = new HostController(model, topoCli, topoSkill);
        await vi.waitFor(() => {
            expect(model.skillStatus).toStrictEqual(loaded('missing'));
        });
        vi.clearAllMocks();
        vi.mocked(topoSkill.getStatus).mockResolvedValue('installed');

        await controller.refreshHostCommandHandler();

        expect(topoCli.hostHealth).toHaveBeenCalledOnce();
        expect(topoSkill.getStatus).toHaveBeenCalledOnce();
        expect(model.health).toStrictEqual(loaded(hostHealth));
        expect(model.skillStatus).toStrictEqual(loaded('installed'));
    });
});
