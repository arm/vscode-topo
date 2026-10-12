import * as vscode from 'vscode';
import { mock } from 'vitest-mock-extended';
import { HostModel } from '../models/hostModel';
import { TopoCli } from '../services/topoCli';
import { HostController } from './hostController';
import { HealthReport, HostHealthCheck } from '../services/topoCliSchema';
import { TopoSkill, type TopoSkillReport } from '../services/topoSkill';
import { loaded } from '../util/loadable';
import { Config } from '../services/config';

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
const hostHealth = {
    capabilities: [{ name: 'Deployment', checks: [hostCheck] }],
};
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
    const topoCli = mock<TopoCli>();
    const topoSkill = mock<TopoSkill>();

    beforeEach(() => {
        vi.stubEnv('TOPO_ENGINE', undefined);
        config.getContainerEngineSetting.mockReturnValue('docker');
        topoCli.hostHealth.mockResolvedValue(healthReport);
        topoSkill.getReport.mockResolvedValue(installedSkillReport);
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    function createController() {
        const model = new HostModel();
        const controller = new HostController(
            model,
            topoCli,
            topoSkill,
            config,
        );
        return { model, controller };
    }

    it('refreshes host health and skill status on creation', async () => {
        config.getContainerEngineSetting.mockReturnValue('podman');
        const { model } = createController();

        await vi.waitFor(() => {
            expect(model.containerEngine).toStrictEqual(loaded('podman'));
            expect(model.health).toStrictEqual(loaded(hostHealth));
            expect(model.skillReport).toStrictEqual(
                loaded(installedSkillReport),
            );
        });
    });

    it('refreshes host health and skill status on command', async () => {
        topoSkill.getReport.mockResolvedValue(missingSkillReport);
        const { model, controller } = createController();
        await vi.waitFor(() => {
            expect(model.skillReport).toStrictEqual(loaded(missingSkillReport));
        });
        vi.clearAllMocks();
        topoSkill.getReport.mockResolvedValue(installedSkillReport);

        await controller.refreshHostCommandHandler();

        expect(topoCli.hostHealth).toHaveBeenCalledOnce();
        expect(topoSkill.getReport).toHaveBeenCalledOnce();
        expect(model.health).toStrictEqual(loaded(hostHealth));
        expect(model.skillReport).toStrictEqual(loaded(installedSkillReport));
    });

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

    it('propagates a failed settings update without changing the displayed engine', async () => {
        const { model, controller } = createController();
        vi.mocked(vscode.window.showQuickPick).mockImplementationOnce(
            async (items) => (await items)[2],
        );
        const error = new Error('Settings are read-only');
        config.setContainerEngine.mockRejectedValueOnce(error);

        await expect(
            controller.selectContainerEngineCommandHandler(),
        ).rejects.toBe(error);

        expect(model.containerEngine).toStrictEqual(loaded('docker'));
    });
});
