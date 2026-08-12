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
    function getSkillStatus(agent: string) {
        return Promise.resolve(
            agent === 'codex' ? ('installed' as const) : ('missing' as const),
        );
    }

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('refreshes host health and skill status on creation', async () => {
        const topoCli = mock<TopoCli>({
            hostHealth: vi.fn().mockResolvedValue(hostHealth),
        });
        const topoSkill = mock<TopoSkill>({
            getStatus: vi.fn().mockImplementation(getSkillStatus),
        });
        const model = new HostModel();

        new HostController(model, topoCli, topoSkill);
        await vi.waitFor(() => {
            expect(model.health).toStrictEqual(loaded(hostHealth));
            expect(model.skillStatuses).toStrictEqual({
                codex: loaded('installed'),
                'claude-code': loaded('missing'),
            });
        });

        expect(topoCli.hostHealth).toHaveBeenCalled();
        expect(topoSkill.getStatus).toHaveBeenCalledWith('codex');
        expect(topoSkill.getStatus).toHaveBeenCalledWith('claude-code');
    });

    it('refreshes host health and skill status on command', async () => {
        const topoCli = mock<TopoCli>({
            hostHealth: vi.fn().mockResolvedValue(hostHealth),
        });
        const topoSkill = mock<TopoSkill>({
            getStatus: vi.fn().mockImplementation(getSkillStatus),
        });
        const model = new HostModel();
        const controller = new HostController(model, topoCli, topoSkill);
        await vi.waitFor(() => {
            expect(model.skillStatuses).toStrictEqual({
                codex: loaded('installed'),
                'claude-code': loaded('missing'),
            });
        });
        vi.clearAllMocks();
        vi.mocked(topoSkill.getStatus).mockResolvedValue('installed');

        await controller.refreshHostCommandHandler();

        expect(topoCli.hostHealth).toHaveBeenCalledOnce();
        expect(topoSkill.getStatus).toHaveBeenCalledTimes(2);
        expect(model.health).toStrictEqual(loaded(hostHealth));
        expect(model.skillStatuses).toStrictEqual({
            codex: loaded('installed'),
            'claude-code': loaded('installed'),
        });
    });

    it('publishes each agent status as its own check completes', async () => {
        const topoCli = mock<TopoCli>({
            hostHealth: vi.fn().mockResolvedValue(hostHealth),
        });
        let resolveCodex!: (status: 'installed') => void;
        let resolveClaude!: (status: 'missing') => void;
        const topoSkill = mock<TopoSkill>({
            getStatus: vi.fn().mockImplementation((agent) =>
                agent === 'codex'
                    ? new Promise((resolve) => {
                          resolveCodex = resolve;
                      })
                    : new Promise((resolve) => {
                          resolveClaude = resolve;
                      }),
            ),
        });
        const model = new HostModel();

        new HostController(model, topoCli, topoSkill);
        await vi.waitFor(() => {
            expect(model.skillStatuses.codex.loading).toBe(true);
            expect(model.skillStatuses['claude-code'].loading).toBe(true);
        });

        resolveCodex('installed');
        await vi.waitFor(() => {
            expect(model.skillStatuses.codex).toStrictEqual(
                loaded('installed'),
            );
            expect(model.skillStatuses['claude-code'].loading).toBe(true);
        });

        resolveClaude('missing');
        await vi.waitFor(() => {
            expect(model.skillStatuses['claude-code']).toStrictEqual(
                loaded('missing'),
            );
        });
    });
});
