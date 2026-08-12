import { createRequire } from 'node:module';
import * as vscode from 'vscode';
import { mock, MockProxy } from 'vitest-mock-extended';
import { refreshSkillStatus } from '../commandIds';
import { NpxSkills } from '../services/npxSkills';
import { TopoSkill, TopoSkillAgent } from '../services/topoSkill';
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
type AgentQuickPickItem = vscode.QuickPickItem & { agent: TopoSkillAgent };
type ShowQuickPickMany = (
    items: AgentQuickPickItem[],
    options: vscode.QuickPickOptions & { canPickMany: true },
) => Thenable<AgentQuickPickItem[] | undefined>;

function selectAgents(...agents: TopoSkillAgent[]): void {
    const labels: Record<TopoSkillAgent, string> = {
        codex: 'Codex',
        'claude-code': 'Claude Code',
    };
    vi.mocked<ShowQuickPickMany>(
        vscode.window.showQuickPick,
    ).mockResolvedValueOnce(
        agents.map((agent) => ({ agent, label: labels[agent] })),
    );
}

const loadModule = createRequire(__filename);
const { uninstallSkill } = loadModule('../../scripts/uninstall.cjs') as {
    uninstallSkill(run: UninstallRunner, platform?: NodeJS.Platform): void;
};

describe('InstallSkill', () => {
    const bundledSkillPath = vscode.Uri.file(
        '/fake/extension/skills/topo-cli-location',
    ).fsPath;
    const codexInstallationPath = '/fake/home/.agents/skills/topo-cli-location';
    const claudeInstallationPath =
        '/fake/home/.claude/skills/topo-cli-location';
    let topoSkill: MockProxy<TopoSkill>;
    let npxSkills: MockProxy<NpxSkills>;
    let action: InstallSkill;

    beforeEach(() => {
        vi.resetAllMocks();
        topoSkill = mock<TopoSkill>({
            bundledDirectoryPath: bundledSkillPath,
        });
        topoSkill.getInstallationDirectoryPath.mockImplementation((agent) =>
            agent === 'codex' ? codexInstallationPath : claudeInstallationPath,
        );
        topoSkill.areAgentsInstalled.mockResolvedValue(true);
        npxSkills = mock<NpxSkills>();
        action = new InstallSkill(topoSkill, npxSkills);
        vi.mocked(vscode.window.withProgress).mockImplementation(
            (_options, task) =>
                task({ report: vi.fn() }, {} as vscode.CancellationToken),
        );
    });

    it('installs the skill for all selected agents in one background process', async () => {
        selectAgents('codex', 'claude-code');

        await action.installSkillCommandHandler();

        expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
            [
                {
                    agent: 'codex',
                    label: 'Codex',
                    description: codexInstallationPath,
                    picked: true,
                },
                {
                    agent: 'claude-code',
                    label: 'Claude Code',
                    description: claudeInstallationPath,
                    picked: true,
                },
            ],
            {
                canPickMany: true,
                placeHolder: 'Select one or more agents',
                title: 'Install Topo Agent Skill',
            },
        );
        expect(npxSkills.add).toHaveBeenCalledWith(bundledSkillPath, [
            'codex',
            'claude-code',
        ]);
        expect(vscode.window.withProgress).toHaveBeenCalledWith(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Installing Topo agent skill…',
            },
            expect.any(Function),
        );
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            refreshSkillStatus,
        );
        expect(topoSkill.areAgentsInstalled).toHaveBeenCalledWith([
            'codex',
            'claude-code',
        ]);
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
            'Topo CLI location skill installed. Start a new agent session to check it out.',
        );
    });

    it('does nothing when agent selection is cancelled', async () => {
        vi.mocked<ShowQuickPickMany>(
            vscode.window.showQuickPick,
        ).mockResolvedValueOnce(undefined);

        await action.installSkillCommandHandler();

        expect(npxSkills.add).not.toHaveBeenCalled();
        expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
        expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
    });

    it('installs directly for the agent selected in the Host view', async () => {
        await action.installSkillCommandHandler('claude-code');

        expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
        expect(npxSkills.add).toHaveBeenCalledWith(bundledSkillPath, [
            'claude-code',
        ]);
        expect(topoSkill.areAgentsInstalled).toHaveBeenCalledWith([
            'claude-code',
        ]);
    });

    it('does not report success when installation verification fails', async () => {
        selectAgents('claude-code');
        topoSkill.areAgentsInstalled.mockResolvedValueOnce(false);

        await action.installSkillCommandHandler();

        expect(topoSkill.areAgentsInstalled).toHaveBeenCalledWith([
            'claude-code',
        ]);
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            refreshSkillStatus,
        );
        expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
    });

    it.each([
        ['linux', 'npx'],
        ['win32', 'npx.cmd'],
    ] as const)(
        'removes the skill from Codex and Claude Code on %s',
        (platform, npx) => {
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
                    'codex',
                    'claude-code',
                    '--yes',
                ],
                { stdio: 'ignore' },
            );
        },
    );

    it('reports skill uninstallation failure', () => {
        const run = vi.fn<UninstallRunner>().mockReturnValue({ status: 1 });

        expect(() => uninstallSkill(run, 'linux')).toThrow(
            'Skill uninstallation failed with exit code 1',
        );
    });
});
