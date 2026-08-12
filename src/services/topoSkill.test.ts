import * as vscode from 'vscode';
import { execFile } from '../util/exec';
import { TopoSkill } from './topoSkill';

vi.mock('../util/exec', () => ({ execFile: vi.fn() }));

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

    function listedSkill(
        path: string,
        agents: string[],
        name = 'topo-cli-location',
    ): ListedSkill {
        return { name, path, scope: 'global', agents };
    }

    function mockList(skills: ListedSkill[]): void {
        vi.mocked(execFile).mockResolvedValue({
            stdout: JSON.stringify(skills),
            stderr: '',
        });
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
        mockList([]);
        mockSkillFiles({});
    });

    it('reports a listed current skill as installed', async () => {
        mockList([listedSkill(codexSkillDirectory, ['Codex'])]);
        mockSkillFiles({
            [`${codexSkillDirectory}/SKILL.md`]: bundledSkill,
        });
        const topoSkill = new TopoSkill(extensionUri, { userHomeUri });

        await expect(topoSkill.getStatus()).resolves.toBe('installed');
        expect(execFile).toHaveBeenCalledWith(
            'npx',
            [
                '--yes',
                'skills',
                'list',
                '--global',
                '--agent',
                'codex',
                'claude-code',
                '--json',
            ],
            {
                cwd: userHomeUri.fsPath,
                encoding: 'utf8',
                windowsHide: true,
            },
        );
    });

    it('uses the path returned by the CLI for copied skills', async () => {
        mockList([listedSkill(claudeSkillDirectory, ['Claude Code'])]);
        mockSkillFiles({
            [`${claudeSkillDirectory}/SKILL.md`]: bundledSkill,
        });
        const topoSkill = new TopoSkill(extensionUri, { userHomeUri });

        await expect(topoSkill.getStatus()).resolves.toBe('installed');
    });

    it('reports a missing skill when it is not listed', async () => {
        mockList([
            listedSkill(
                '/fake/home/.agents/skills/another',
                ['Codex'],
                'other',
            ),
        ]);
        const topoSkill = new TopoSkill(extensionUri, { userHomeUri });

        await expect(topoSkill.getStatus()).resolves.toBe('missing');
        expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled();
    });

    it('ignores installations listed for unsupported agents', async () => {
        mockList([listedSkill('/fake/home/.cursor/skills/topo', ['Cursor'])]);
        const topoSkill = new TopoSkill(extensionUri, { userHomeUri });

        await expect(topoSkill.getStatus()).resolves.toBe('missing');
        expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled();
    });

    it('reports a listed skill with different contents as outdated', async () => {
        mockList([listedSkill(claudeSkillDirectory, ['Claude Code'])]);
        mockSkillFiles({
            [`${claudeSkillDirectory}/SKILL.md`]: Uint8Array.from([1, 2, 4]),
        });
        const topoSkill = new TopoSkill(extensionUri, { userHomeUri });

        await expect(topoSkill.getStatus()).resolves.toBe('outdated');
    });

    it('verifies only agents selected for the current installation', async () => {
        mockList([listedSkill(claudeSkillDirectory, ['Claude Code'])]);
        mockSkillFiles({
            [`${claudeSkillDirectory}/SKILL.md`]: bundledSkill,
        });
        const topoSkill = new TopoSkill(extensionUri, { userHomeUri });

        await expect(
            topoSkill.areAgentsInstalled(['claude-code']),
        ).resolves.toBe(true);
        await expect(
            topoSkill.areAgentsInstalled(['codex', 'claude-code']),
        ).resolves.toBe(false);
    });

    it('uses npx.cmd on Windows', async () => {
        const topoSkill = new TopoSkill(extensionUri, {
            userHomeUri,
            platform: 'win32',
        });

        await topoSkill.getStatus();

        expect(execFile).toHaveBeenCalledWith(
            'npx.cmd',
            expect.any(Array),
            expect.any(Object),
        );
    });

    it('rejects malformed list output', async () => {
        vi.mocked(execFile).mockResolvedValue({
            stdout: '{}',
            stderr: '',
        });
        const topoSkill = new TopoSkill(extensionUri, { userHomeUri });

        await expect(topoSkill.getStatus()).rejects.toThrow(
            'Unexpected output from skills list',
        );
    });

    it('provides the bundled skill directory as the install source', () => {
        const topoSkill = new TopoSkill(extensionUri, {
            userHomeUri,
            environment: {},
        });

        expect(topoSkill.bundledDirectoryPath).toBe(
            vscode.Uri.joinPath(extensionUri, 'skills', 'topo-cli-location')
                .fsPath,
        );
    });

    it('provides the final installation directory for each agent', () => {
        const topoSkill = new TopoSkill(extensionUri, {
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
