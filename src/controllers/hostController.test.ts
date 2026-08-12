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
const installedSkillReport = {
    status: 'installed' as const,
    agents: [
        {
            name: 'Claude Code',
            paths: ['/fake/home/.claude/skills/topo-cli-location'],
            status: 'installed' as const,
        },
    ],
};
const missingSkillReport = {
    status: 'missing' as const,
    agents: [],
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
            getReport: vi.fn().mockResolvedValue(installedSkillReport),
        });
        const model = new HostModel();

        new HostController(model, topoCli, topoSkill);
        await vi.waitFor(() => {
            expect(model.health).toStrictEqual(loaded(hostHealth));
            expect(model.skillReport).toStrictEqual(
                loaded(installedSkillReport),
            );
        });

        expect(topoCli.hostHealth).toHaveBeenCalled();
        expect(topoSkill.getReport).toHaveBeenCalled();
    });

    it('refreshes host health and skill status on command', async () => {
        const topoCli = mock<TopoCli>({
            hostHealth: vi.fn().mockResolvedValue(hostHealth),
        });
        const topoSkill = mock<TopoSkill>({
            getReport: vi.fn().mockResolvedValue(missingSkillReport),
        });
        const model = new HostModel();
        const controller = new HostController(model, topoCli, topoSkill);
        await vi.waitFor(() => {
            expect(model.skillReport).toStrictEqual(loaded(missingSkillReport));
        });
        vi.clearAllMocks();
        vi.mocked(topoSkill.getReport).mockResolvedValue(installedSkillReport);

        await controller.refreshHostCommandHandler();

        expect(topoCli.hostHealth).toHaveBeenCalledOnce();
        expect(topoSkill.getReport).toHaveBeenCalledOnce();
        expect(model.health).toStrictEqual(loaded(hostHealth));
        expect(model.skillReport).toStrictEqual(loaded(installedSkillReport));
    });
});
