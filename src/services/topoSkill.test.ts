import * as vscode from 'vscode';
import { mock, MockProxy } from 'vitest-mock-extended';
import { ListedSkill, NpxSkills } from './npxSkills';
import { TopoSkill } from './topoSkill';

describe('TopoSkill', () => {
    const extensionUri = vscode.Uri.file('/fake/extension');
    const bundledDirectory = vscode.Uri.joinPath(
        extensionUri,
        'skills',
        'topo-cli-location',
    );
    const bundledSkillFile = vscode.Uri.joinPath(
        bundledDirectory,
        'SKILL.md',
    ).fsPath;
    const installedDirectory = '/fake/home/.agents/skills/topo-cli-location';
    const bundledSkill = Uint8Array.from([1, 2, 3]);
    let npxSkills: MockProxy<NpxSkills>;

    function listedSkill(
        path = installedDirectory,
        agents: string[] = ['Codex'],
        name = 'topo-cli-location',
    ): ListedSkill {
        return { name, path, agents };
    }

    function skillFile(directory: string): string {
        return vscode.Uri.joinPath(vscode.Uri.file(directory), 'SKILL.md')
            .fsPath;
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

    beforeEach(() => {
        vi.resetAllMocks();
        npxSkills = mock<NpxSkills>();
        npxSkills.listGlobal.mockResolvedValue([]);
        mockSkillFiles({});
    });

    it('reports a listed current skill as installed', async () => {
        npxSkills.listGlobal.mockResolvedValue([listedSkill()]);
        mockSkillFiles({ [skillFile(installedDirectory)]: bundledSkill });
        const topoSkill = new TopoSkill(extensionUri, npxSkills);

        await expect(topoSkill.getReport()).resolves.toEqual({
            status: 'installed',
            agents: [
                {
                    name: 'Codex',
                    paths: [installedDirectory],
                    status: 'installed',
                },
            ],
        });
        expect(npxSkills.listGlobal).toHaveBeenCalledExactlyOnceWith();
    });

    it('uses the installation path returned by the CLI', async () => {
        const claudeDirectory = '/fake/home/.claude/skills/topo-cli-location';
        npxSkills.listGlobal.mockResolvedValue([
            listedSkill(claudeDirectory, ['Claude Code']),
        ]);
        mockSkillFiles({ [skillFile(claudeDirectory)]: bundledSkill });
        const topoSkill = new TopoSkill(extensionUri, npxSkills);

        await expect(topoSkill.getReport()).resolves.toMatchObject({
            agents: [{ name: 'Claude Code', paths: [claudeDirectory] }],
        });
        expect(
            vi.mocked(vscode.workspace.fs.readFile).mock.calls[1][0].fsPath,
        ).toBe(skillFile(claudeDirectory));
    });

    it('reports a missing skill when it is not listed', async () => {
        npxSkills.listGlobal.mockResolvedValue([
            listedSkill('/fake/other', ['Codex'], 'other'),
        ]);
        const topoSkill = new TopoSkill(extensionUri, npxSkills);

        await expect(topoSkill.getReport()).resolves.toEqual({
            status: 'missing',
            agents: [],
        });
        expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled();
    });

    it('ignores an installation that is not linked to any agent', async () => {
        npxSkills.listGlobal.mockResolvedValue([
            listedSkill(installedDirectory, []),
        ]);
        const topoSkill = new TopoSkill(extensionUri, npxSkills);

        await expect(topoSkill.getReport()).resolves.toEqual({
            status: 'missing',
            agents: [],
        });
        expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled();
    });

    it('reports a listed skill with different contents as outdated', async () => {
        npxSkills.listGlobal.mockResolvedValue([listedSkill()]);
        mockSkillFiles({
            [skillFile(installedDirectory)]: Uint8Array.from([1, 2, 4]),
        });
        const topoSkill = new TopoSkill(extensionUri, npxSkills);

        await expect(topoSkill.getReport()).resolves.toEqual({
            status: 'outdated',
            agents: [
                {
                    name: 'Codex',
                    paths: [installedDirectory],
                    status: 'outdated',
                },
            ],
        });
    });

    it('reports each agent and does not hide an outdated installation', async () => {
        const secondDirectory = '/fake/home/.another/skills/topo-cli-location';
        npxSkills.listGlobal.mockResolvedValue([
            listedSkill(),
            listedSkill(secondDirectory, ['Claude Code']),
        ]);
        mockSkillFiles({
            [skillFile(installedDirectory)]: Uint8Array.from([1, 2, 4]),
            [skillFile(secondDirectory)]: bundledSkill,
        });
        const topoSkill = new TopoSkill(extensionUri, npxSkills);

        await expect(topoSkill.getReport()).resolves.toEqual({
            status: 'outdated',
            agents: [
                {
                    name: 'Claude Code',
                    paths: [secondDirectory],
                    status: 'installed',
                },
                {
                    name: 'Codex',
                    paths: [installedDirectory],
                    status: 'outdated',
                },
            ],
        });
    });

    it('groups multiple paths reported for the same agent', async () => {
        const secondDirectory = '/fake/home/.codex/skills/topo-cli-location';
        npxSkills.listGlobal.mockResolvedValue([
            listedSkill(),
            listedSkill(secondDirectory),
        ]);
        mockSkillFiles({
            [skillFile(installedDirectory)]: bundledSkill,
            [skillFile(secondDirectory)]: Uint8Array.from([1, 2, 4]),
        });
        const topoSkill = new TopoSkill(extensionUri, npxSkills);

        await expect(topoSkill.getReport()).resolves.toEqual({
            status: 'outdated',
            agents: [
                {
                    name: 'Codex',
                    paths: [installedDirectory, secondDirectory],
                    status: 'outdated',
                },
            ],
        });
    });

    it('creates an interactive task to install the bundled skill globally', () => {
        const task = mock<vscode.Task>();
        npxSkills.createAddGlobalTask.mockReturnValue(task);
        const topoSkill = new TopoSkill(extensionUri, npxSkills);

        expect(topoSkill.createInstallTask()).toBe(task);
        expect(npxSkills.createAddGlobalTask).toHaveBeenCalledExactlyOnceWith(
            'Install Topo Agent Skill',
            bundledDirectory.fsPath,
        );
    });
});
