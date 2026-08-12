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
    const skillStatuses = {
        codex: 'installed',
        'claude-code': 'missing',
    } as const;

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('refreshes host health and skill status on creation', async () => {
        const topoCli = mock<TopoCli>({
            hostHealth: vi.fn().mockResolvedValue(hostHealth),
        });
        const topoSkill = mock<TopoSkill>({
            getStatuses: vi.fn().mockResolvedValue(skillStatuses),
        });
        const model = new HostModel();

        new HostController(model, topoCli, topoSkill);
        await vi.waitFor(() => {
            expect(model.health).toStrictEqual(loaded(hostHealth));
            expect(model.skillStatuses).toStrictEqual(loaded(skillStatuses));
        });

        expect(topoCli.hostHealth).toHaveBeenCalled();
        expect(topoSkill.getStatuses).toHaveBeenCalled();
    });

    it('refreshes host health and skill status on command', async () => {
        const topoCli = mock<TopoCli>({
            hostHealth: vi.fn().mockResolvedValue(hostHealth),
        });
        const topoSkill = mock<TopoSkill>({
            getStatuses: vi.fn().mockResolvedValue(skillStatuses),
        });
        const model = new HostModel();
        const controller = new HostController(model, topoCli, topoSkill);
        await vi.waitFor(() => {
            expect(model.skillStatuses).toStrictEqual(loaded(skillStatuses));
        });
        vi.clearAllMocks();
        const updatedSkillStatuses = {
            codex: 'installed',
            'claude-code': 'installed',
        } as const;
        vi.mocked(topoSkill.getStatuses).mockResolvedValue(
            updatedSkillStatuses,
        );

        await controller.refreshHostCommandHandler();

        expect(topoCli.hostHealth).toHaveBeenCalledOnce();
        expect(topoSkill.getStatuses).toHaveBeenCalledOnce();
        expect(model.health).toStrictEqual(loaded(hostHealth));
        expect(model.skillStatuses).toStrictEqual(loaded(updatedSkillStatuses));
    });
});
