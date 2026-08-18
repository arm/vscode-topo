import { createRequire } from 'node:module';
import * as vscode from 'vscode';
import { mock, MockProxy } from 'vitest-mock-extended';
import { refreshSkillStatus } from '../commandIds';
import { TopoSkill } from '../services/topoSkill';
import { runTask } from '../util/task';
import { InstallSkill } from './installSkill';

vi.mock('../util/task', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../util/task')>()),
    runTask: vi.fn(),
}));

const mockRunTask = vi.mocked(runTask);

type UninstallResult = {
    error?: Error;
    status: number | null;
};
type UninstallRunner = (
    command: string,
    args: string[],
    options: { stdio: 'ignore' },
) => UninstallResult;

const loadModule = createRequire(__filename);
const { uninstallSkill } = loadModule('../../scripts/uninstall.cjs') as {
    uninstallSkill(run: UninstallRunner, platform?: NodeJS.Platform): void;
};

describe('InstallSkill', () => {
    let topoSkill: MockProxy<TopoSkill>;
    let action: InstallSkill;

    beforeEach(() => {
        vi.resetAllMocks();
        topoSkill = mock<TopoSkill>();
        topoSkill.createInstallCommand.mockReturnValue({
            executable: 'npx',
            arguments: ['--yes', 'skills', 'add', '/fake/skill', '--global'],
            cwd: '/fake/home',
        });
        action = new InstallSkill(topoSkill);
    });

    it('runs the upstream interactive installer as a task', async () => {
        await action.installSkillCommandHandler();

        expect(
            topoSkill.createInstallCommand,
        ).toHaveBeenCalledExactlyOnceWith();
        expect(mockRunTask).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({
                name: 'Install Topo Agent Skill',
                execution: expect.objectContaining({
                    process: 'npx',
                    args: ['--yes', 'skills', 'add', '/fake/skill', '--global'],
                    options: { cwd: '/fake/home' },
                }),
            }),
        );
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            refreshSkillStatus,
        );
    });

    it('does not refresh skill status when installation fails', async () => {
        mockRunTask.mockRejectedValue(new Error('install failed'));

        await expect(action.installSkillCommandHandler()).rejects.toThrow(
            'install failed',
        );
        expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    it.each([
        ['linux', 'npx'],
        ['win32', 'npx.cmd'],
    ] as const)('removes the skill from all agents on %s', (platform, npx) => {
        const run = vi.fn<UninstallRunner>().mockReturnValue({ status: 0 });

        uninstallSkill(run, platform);

        expect(run).toHaveBeenCalledExactlyOnceWith(
            npx,
            [
                '--yes',
                'skills',
                'remove',
                'topo-cli-location',
                '--global',
                '--agent',
                '*',
                '--yes',
            ],
            { stdio: 'ignore' },
        );
    });

    it('reports skill uninstallation failure', () => {
        const run = vi.fn<UninstallRunner>().mockReturnValue({ status: 1 });

        expect(() => uninstallSkill(run, 'linux')).toThrow(
            'Skill uninstallation failed with exit code 1',
        );
    });
});
