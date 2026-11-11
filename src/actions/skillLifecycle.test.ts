import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import * as vscode from 'vscode';
import { mock, MockProxy } from 'vitest-mock-extended';
import { refreshSkillStatus } from '../commandIds';
import { TopoSkill } from '../services/topoSkill';
import { runTask } from '../util/task';
import { SkillLifecycle } from './skillLifecycle';

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
    uninstallSkill(run: UninstallRunner): void;
};

describe('SkillLifecycle', () => {
    let topoSkill: MockProxy<TopoSkill>;
    let execution: MockProxy<vscode.ShellExecution>;
    let lifecycle: SkillLifecycle;

    beforeEach(() => {
        vi.resetAllMocks();
        topoSkill = mock<TopoSkill>();
        execution = mock<vscode.ShellExecution>();
        topoSkill.createInstallCommand.mockReturnValue(execution);
        topoSkill.createUninstallCommand.mockReturnValue(execution);
        lifecycle = new SkillLifecycle(topoSkill);
    });

    it('installs the skill as a task and refreshes status', async () => {
        await lifecycle.installSkillCommandHandler();

        expect(
            topoSkill.createInstallCommand,
        ).toHaveBeenCalledExactlyOnceWith();
        expect(mockRunTask).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({
                name: 'Install Topo Agent Skill',
                execution,
            }),
        );
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            refreshSkillStatus,
        );
    });

    it('uninstalls the skill as a task and refreshes status', async () => {
        await lifecycle.uninstallSkillCommandHandler();

        expect(
            topoSkill.createUninstallCommand,
        ).toHaveBeenCalledExactlyOnceWith();
        expect(mockRunTask).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({
                name: 'Uninstall Topo Agent Skill',
                execution,
            }),
        );
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            refreshSkillStatus,
        );
    });

    it('does not refresh skill status when the task fails', async () => {
        mockRunTask.mockRejectedValue(new Error('install failed'));

        await expect(lifecycle.installSkillCommandHandler()).rejects.toThrow(
            'install failed',
        );
        expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });
});

describe('extension uninstall hook', () => {
    it('removes the skill from all agents', () => {
        const run = vi.fn<UninstallRunner>().mockReturnValue({ status: 0 });

        uninstallSkill(run);

        expect(run).toHaveBeenCalledExactlyOnceWith(
            process.execPath,
            [
                resolve(__dirname, '../../node_modules/skills/bin/cli.mjs'),
                'remove',
                'topo-cli-location',
                '--global',
                '--yes',
            ],
            {
                cwd: homedir(),
                env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
                stdio: 'ignore',
            },
        );
    });

    it('reports skill uninstallation failure', () => {
        const run = vi.fn<UninstallRunner>().mockReturnValue({ status: 1 });

        expect(() => uninstallSkill(run)).toThrow(
            'Skill uninstallation failed with exit code 1',
        );
    });
});
