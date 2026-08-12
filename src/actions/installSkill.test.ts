import { createRequire } from 'node:module';
import * as vscode from 'vscode';
import { mock, MockProxy } from 'vitest-mock-extended';
import { refreshSkillStatus } from '../commandIds';
import { TopoSkill } from '../services/topoSkill';
import { TaskExecutor } from '../util/taskExecutor';
import { InstallSkill } from './installSkill';

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
    let task: MockProxy<vscode.Task>;
    let taskExecutor: MockProxy<TaskExecutor>;
    let action: InstallSkill;

    beforeEach(() => {
        vi.resetAllMocks();
        task = mock<vscode.Task>();
        topoSkill = mock<TopoSkill>();
        topoSkill.createInstallTask.mockReturnValue(task);
        taskExecutor = mock<TaskExecutor>();
        taskExecutor.run.mockResolvedValue();
        action = new InstallSkill(topoSkill, taskExecutor);
    });

    it('runs the upstream interactive installer as a task', async () => {
        await action.installSkillCommandHandler();

        expect(topoSkill.createInstallTask).toHaveBeenCalledExactlyOnceWith();
        expect(taskExecutor.run).toHaveBeenCalledExactlyOnceWith(task);
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            refreshSkillStatus,
        );
    });

    it('does not refresh skill status when installation fails', async () => {
        taskExecutor.run.mockRejectedValue(new Error('install failed'));

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
