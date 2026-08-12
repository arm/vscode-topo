import * as vscode from 'vscode';
import { mock, MockProxy } from 'vitest-mock-extended';
import { NpxSkills } from './npxSkills';
import { TopoSkill } from './topoSkill';

interface ListedSkill {
    name: string;
    path: string;
    scope: string;
    agents: string[];
}

describe('TopoSkill', () => {
    const extensionUri = vscode.Uri.file('/fake/extension');
    const userHomeUri = vscode.Uri.file('/fake/home');
    const bundledSkillFile = vscode.Uri.joinPath(
        extensionUri,
        'skills',
        'topo-cli-location',
        'SKILL.md',
    ).fsPath;
    const codexSkillDirectory = '/fake/home/.agents/skills/topo-cli-location';
    const claudeSkillDirectory = '/fake/home/.claude/skills/topo-cli-location';
    const bundledSkill = Uint8Array.from([1, 2, 3]);
    let npxSkills: MockProxy<NpxSkills>;

    function listedSkill(
        path: string,
        agents: string[],
        name = 'topo-cli-location',
    ): ListedSkill {
        return { name, path, scope: 'global', agents };
    }

    function mockList(skills: ListedSkill[]): void {
        npxSkills.list.mockResolvedValue(skills);
    }

    function mockSkillFiles(files: Readonly<Record<string, Uint8Array>>): void {
        vi.mocked(vscode.workspace.fs.readFile).mockImplementation((uri) => {
            if (uri.fsPath === bundledSkillFile) {
                return Promise.resolve(bundledSkill);
            }
            const contents = files[uri.fsPath];
            return contents
                ? Promise.resolve(contents)
                : Promise.reject(vscode.FileSystemError.FileNotFound(uri));
        });
    }

    async function getStatuses(topoSkill: TopoSkill) {
        const [codex, claudeCode] = await Promise.all([
            topoSkill.getStatus('codex'),
            topoSkill.getStatus('claude-code'),
        ]);
        return { codex, 'claude-code': claudeCode };
    }

    beforeEach(() => {
        vi.resetAllMocks();
        npxSkills = mock<NpxSkills>({ userHomePath: userHomeUri.fsPath });
        mockList([]);
        mockSkillFiles({});
    });

    it('reports a listed current skill as installed', async () => {
        mockList([listedSkill(codexSkillDirectory, ['Codex'])]);
        mockSkillFiles({
            [`${codexSkillDirectory}/SKILL.md`]: bundledSkill,
        });
        const topoSkill = new TopoSkill(extensionUri, npxSkills, {
            userHomeUri,
        });

        await expect(getStatuses(topoSkill)).resolves.toEqual({
            codex: 'installed',
            'claude-code': 'missing',
        });
        expect(npxSkills.list).toHaveBeenCalledTimes(2);
        for (const agent of ['codex', 'claude-code']) {
            expect(npxSkills.list).toHaveBeenCalledWith([agent]);
        }
    });

    it('uses the path returned by the CLI for copied skills', async () => {
        mockList([listedSkill(claudeSkillDirectory, ['Claude Code'])]);
        mockSkillFiles({
            [`${claudeSkillDirectory}/SKILL.md`]: bundledSkill,
        });
        const topoSkill = new TopoSkill(extensionUri, npxSkills, {
            userHomeUri,
        });

        await expect(getStatuses(topoSkill)).resolves.toEqual({
            codex: 'missing',
            'claude-code': 'installed',
        });
    });

    it('reports a missing skill when it is not listed', async () => {
        mockList([
            listedSkill(
                '/fake/home/.agents/skills/another',
                ['Codex'],
                'other',
            ),
        ]);
        const topoSkill = new TopoSkill(extensionUri, npxSkills, {
            userHomeUri,
        });

        await expect(getStatuses(topoSkill)).resolves.toEqual({
            codex: 'missing',
            'claude-code': 'missing',
        });
        expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled();
    });

    it('ignores installations listed for unsupported agents', async () => {
        mockList([listedSkill('/fake/home/.cursor/skills/topo', ['Cursor'])]);
        const topoSkill = new TopoSkill(extensionUri, npxSkills, {
            userHomeUri,
        });

        await expect(getStatuses(topoSkill)).resolves.toEqual({
            codex: 'missing',
            'claude-code': 'missing',
        });
        expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled();
    });

    it('reports a listed skill with different contents as outdated', async () => {
        mockList([listedSkill(claudeSkillDirectory, ['Claude Code'])]);
        mockSkillFiles({
            [`${claudeSkillDirectory}/SKILL.md`]: Uint8Array.from([1, 2, 4]),
        });
        const topoSkill = new TopoSkill(extensionUri, npxSkills, {
            userHomeUri,
        });

        await expect(getStatuses(topoSkill)).resolves.toEqual({
            codex: 'missing',
            'claude-code': 'outdated',
        });
    });

    it('verifies only agents selected for the current installation', async () => {
        mockList([listedSkill(claudeSkillDirectory, ['Claude Code'])]);
        mockSkillFiles({
            [`${claudeSkillDirectory}/SKILL.md`]: bundledSkill,
        });
        const topoSkill = new TopoSkill(extensionUri, npxSkills, {
            userHomeUri,
        });

        await expect(
            topoSkill.areAgentsInstalled(['claude-code']),
        ).resolves.toBe(true);
        await expect(
            topoSkill.areAgentsInstalled(['codex', 'claude-code']),
        ).resolves.toBe(false);
    });

    it('provides the bundled skill directory as the install source', () => {
        const topoSkill = new TopoSkill(extensionUri, npxSkills, {
            userHomeUri,
            environment: {},
        });

        expect(topoSkill.bundledDirectoryPath).toBe(
            vscode.Uri.joinPath(extensionUri, 'skills', 'topo-cli-location')
                .fsPath,
        );
    });

    it('provides the final installation directory for each agent', () => {
        const topoSkill = new TopoSkill(extensionUri, npxSkills, {
            userHomeUri,
            environment: {
                CLAUDE_CONFIG_DIR: '/fake/custom-claude',
            },
        });

        expect(topoSkill.getInstallationDirectoryPath('codex')).toBe(
            codexSkillDirectory,
        );
        expect(topoSkill.getInstallationDirectoryPath('claude-code')).toBe(
            '/fake/custom-claude/skills/topo-cli-location',
        );
    });
});
