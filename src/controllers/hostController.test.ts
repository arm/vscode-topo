import { mock } from 'vitest-mock-extended';
import { HostModel } from '../models/hostModel';
import { TopoCli } from '../services/topoCli';
import { HostController } from './hostController';
import { HealthReport, HostHealthCheck } from '../services/topoCliSchema';
import { TopoSkill, type TopoSkillReport } from '../services/topoSkill';
import { loaded } from '../util/loadable';
import { Config } from '../services/config';
import { getHostHealth } from '../util/healthReport';

const hostCheck: HostHealthCheck = {
    name: 'Container Engine',
    status: 'ok',
    value: 'docker',
    location: 'host',
};
const healthReport: HealthReport = {
    capabilities: [
        {
            name: 'Deployment',
            status: 'error',
            checks: [
                hostCheck,
                {
                    name: 'Connectivity',
                    status: 'error',
                    value: 'unreachable',
                    location: 'target',
                },
            ],
        },
    ],
};
const hostHealth = getHostHealth(healthReport);
const installedSkillReport: TopoSkillReport = {
    status: 'installed',
    agents: [
        {
            name: 'Claude Code',
            paths: ['/fake/home/.claude/skills/topo-cli-location'],
            status: 'installed',
        },
    ],
};
const missingSkillReport: TopoSkillReport = {
    status: 'missing',
    agents: [],
};

describe('HostController', () => {
    const config = mock<Config>();

    beforeEach(() => {
        config.getContainerEngineSetting.mockReturnValue('docker');
    });

    it('refreshes host health and skill status on creation', async () => {
        config.getContainerEngineSetting.mockReturnValue('podman');
        const topoCli = mock<TopoCli>({
            hostHealth: vi.fn().mockResolvedValue(healthReport),
        });
        const topoSkill = mock<TopoSkill>({
            getReport: vi.fn().mockResolvedValue(installedSkillReport),
        });
        const model = new HostModel();

        new HostController(model, topoCli, topoSkill, config);
        await vi.waitFor(() => {
            expect(model.containerEngine).toStrictEqual(loaded('podman'));
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
            hostHealth: vi.fn().mockResolvedValue(healthReport),
        });
        const topoSkill = mock<TopoSkill>({
            getReport: vi.fn().mockResolvedValue(missingSkillReport),
        });
        const model = new HostModel();
        const controller = new HostController(
            model,
            topoCli,
            topoSkill,
            config,
        );
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

    it('keeps the latest host health when an earlier refresh finishes later', async () => {
        const model = new HostModel();
        const topoCli = mock<TopoCli>({
            hostHealth: vi.fn().mockResolvedValue(healthReport),
        });
        const controller = new HostController(
            model,
            topoCli,
            mock<TopoSkill>(),
            config,
        );
        let resolvePreviousHealth!: (health: HealthReport) => void;
        topoCli.hostHealth.mockReturnValueOnce(
            new Promise((resolve) => {
                resolvePreviousHealth = resolve;
            }),
        );
        const previousRefresh = controller.refreshHealthCommandHandler();

        await controller.refreshHealthCommandHandler();
        resolvePreviousHealth({ capabilities: [] });
        await previousRefresh;

        expect(model.health).toStrictEqual(loaded(hostHealth));
    });
});
