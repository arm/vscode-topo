import * as vscode from 'vscode';
import { mock } from 'vitest-mock-extended';
import { HostModel } from '../models/hostModel';
import { TopoCli } from '../services/topoCli';
import { HostController } from './hostController';
import { HealthReport, HostHealthCheck } from '../services/topoCliSchema';
import { TopoSkill } from '../services/topoSkill';
import { loaded } from '../util/loadable';
import { Config } from '../services/config';

vi.mock('../util/logger');

const hostCheck: HostHealthCheck = {
    name: 'Container Engine',
    status: 'ok',
    value: 'docker',
    location: 'host',
};
const hostHealth: HealthReport = {
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
    const config = mock<Config>();

    beforeEach(() => {
        vi.stubEnv('TOPO_ENGINE', undefined);
        config.getContainerEngineSetting.mockReturnValue('docker');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetAllMocks();
    });

    it('refreshes only host checks and skill status on creation', async () => {
        config.getContainerEngineSetting.mockReturnValue('podman');
        const topoCli = mock<TopoCli>({
            hostHealth: vi.fn().mockResolvedValue(hostHealth),
        });
        const topoSkill = mock<TopoSkill>({
            getReport: vi.fn().mockResolvedValue(installedSkillReport),
        });
        const model = new HostModel();

        new HostController(model, topoCli, topoSkill, config);
        await vi.waitFor(() => {
            expect(model.containerEngine).toBe('podman');
            expect(model.health).toStrictEqual(loaded([hostCheck]));
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
        expect(model.health).toStrictEqual(loaded([hostCheck]));
        expect(model.skillReport).toStrictEqual(loaded(installedSkillReport));
    });

    function createController() {
        const model = new HostModel();
        const topoCli = mock<TopoCli>({
            hostHealth: vi.fn().mockResolvedValue(hostHealth),
        });
        const controller = new HostController(
            model,
            topoCli,
            mock<TopoSkill>(),
            config,
        );
        return { model, topoCli, controller };
    }

    it('shows the environment default and saves an explicit engine', async () => {
        config.getContainerEngineSetting.mockReturnValue('auto');
        vi.stubEnv('TOPO_ENGINE', 'podman');
        const { controller } = createController();
        vi.mocked(vscode.window.showQuickPick).mockImplementationOnce(
            async (items) => {
                const choices = await items;
                expect(choices).toMatchObject([
                    {
                        label: 'auto',
                        description: 'Current',
                        detail: 'TOPO_ENGINE env var (or docker if unset)',
                    },
                    {
                        label: 'docker',
                        detail: 'Override TOPO_ENGINE=podman',
                    },
                    { label: 'podman' },
                ]);
                return choices[2];
            },
        );

        await controller.selectContainerEngineCommandHandler();

        expect(config.setContainerEngine).toHaveBeenCalledExactlyOnceWith(
            'podman',
        );
    });

    it('does not save a cancelled selection', async () => {
        const { controller } = createController();
        vi.mocked(vscode.window.showQuickPick).mockResolvedValueOnce(undefined);

        await controller.selectContainerEngineCommandHandler();

        expect(config.setContainerEngine).not.toHaveBeenCalled();
    });

    it('reports a failed settings update without changing the displayed engine', async () => {
        const { model, controller } = createController();
        vi.mocked(vscode.window.showQuickPick).mockImplementationOnce(
            async (items) => (await items)[2],
        );
        config.setContainerEngine.mockRejectedValueOnce(
            new Error('Settings are read-only'),
        );

        await controller.selectContainerEngineCommandHandler();

        expect(model.containerEngine).toBe('docker');
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            expect.stringContaining('Settings are read-only'),
        );
    });

    it('ignores health from a previous engine after another refresh starts', async () => {
        const { model, topoCli, controller } = createController();
        await controller.refreshHealthCommandHandler();
        let resolvePreviousHealth!: (health: HealthReport) => void;
        topoCli.hostHealth.mockReturnValueOnce(
            new Promise((resolve) => {
                resolvePreviousHealth = resolve;
            }),
        );
        const previousRefresh = controller.refreshHealthCommandHandler();
        const podmanCheck: HostHealthCheck = { ...hostCheck, value: 'podman' };
        const podmanHealth: HealthReport = {
            capabilities: [
                {
                    name: 'Deployment',
                    status: 'ok',
                    checks: [podmanCheck],
                },
            ],
        };
        topoCli.hostHealth.mockResolvedValueOnce(podmanHealth);

        await controller.refreshHealthCommandHandler();
        resolvePreviousHealth(hostHealth);
        await previousRefresh;

        expect(model.health).toStrictEqual(loaded([podmanCheck]));
    });
});
