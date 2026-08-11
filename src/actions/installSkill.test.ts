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
    const bundledSkillPath = vscode.Uri.file(
        '/fake/extension/skills/topo-cli-location',
    ).fsPath;
    let topoSkill: MockProxy<TopoSkill>;
    let taskExecutor: MockProxy<TaskExecutor>;
    let action: InstallSkill;

    beforeEach(() => {
        vi.resetAllMocks();
        topoSkill = mock<TopoSkill>({
            bundledDirectoryPath: bundledSkillPath,
        });
        taskExecutor = mock<TaskExecutor>();
        action = new InstallSkill(topoSkill, taskExecutor);
    });

    it('opens the interactive global skill installer', async () => {
        await action.installSkillCommandHandler();

        expect(taskExecutor.run).toHaveBeenCalledOnce();
        expect(taskExecutor.run.mock.calls[0][0]).toMatchObject({
            name: 'Install Topo skill',
            definition: {
                type: 'process',
                command: 'npx',
                args: ['skills', 'add', bundledSkillPath, '--global'],
            },
        });
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            refreshSkillStatus,
        );
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
            'Topo CLI location skill installed. Start a new agent session to check it out.',
        );
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
