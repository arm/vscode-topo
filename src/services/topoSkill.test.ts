import { existsSync } from 'node:fs';
import { cp, readFile } from 'node:fs/promises';
import path from 'node:path';
import { ensureSkillLink, isSkillLink } from '../util/skillLink';
import { TopoSkill } from './topoSkill';

vi.mock('node:fs');
vi.mock('node:fs/promises');
vi.mock('../util/skillLink');

describe('TopoSkill', () => {
    const extensionPath = '/fake/extension';
    const userHomePath = '/fake/home';
    const bundledDirectoryPath = path.join(
        extensionPath,
        'skills',
        'topo-cli-location',
    );
    const canonicalSkillPath = path.join(
        userHomePath,
        '.agents',
        'skills',
        'topo-cli-location',
    );
    const claudeSkillPath = path.join(
        userHomePath,
        '.claude',
        'skills',
        'topo-cli-location',
    );

    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(existsSync).mockReturnValue(false);
        vi.mocked(isSkillLink).mockResolvedValue(true);
    });

    it('reports an installed skill when the files and Claude link match', async () => {
        vi.mocked(readFile).mockResolvedValue(Buffer.from([1, 2, 3]));
        vi.mocked(existsSync).mockReturnValue(true);
        const topoSkill = new TopoSkill(extensionPath, userHomePath);

        await expect(topoSkill.getStatus()).resolves.toBe('installed');
        expect(isSkillLink).toHaveBeenCalledWith(
            canonicalSkillPath,
            claudeSkillPath,
        );
    });

    it('reports a missing skill when the installed skill file does not exist', async () => {
        const missingSkillError = Object.assign(new Error('missing skill'), {
            code: 'ENOENT',
        });
        vi.mocked(readFile)
            .mockResolvedValueOnce(Buffer.from([1, 2, 3]))
            .mockRejectedValueOnce(missingSkillError);
        const topoSkill = new TopoSkill(extensionPath, userHomePath);

        await expect(topoSkill.getStatus()).resolves.toBe('missing');
    });

    it('reports an outdated skill when the installed skill file differs', async () => {
        vi.mocked(readFile)
            .mockResolvedValueOnce(Buffer.from([1, 2, 3]))
            .mockResolvedValueOnce(Buffer.from([1, 2, 4]));
        const topoSkill = new TopoSkill(extensionPath, userHomePath);

        await expect(topoSkill.getStatus()).resolves.toBe('outdated');
    });

    it('reports an outdated skill when the Claude skill link is missing', async () => {
        vi.mocked(readFile).mockResolvedValue(Buffer.from([1, 2, 3]));
        vi.mocked(existsSync).mockReturnValue(true);
        vi.mocked(isSkillLink).mockResolvedValue(false);
        const topoSkill = new TopoSkill(extensionPath, userHomePath);

        await expect(topoSkill.getStatus()).resolves.toBe('outdated');
    });

    it('installs the bundled skill and links it when Claude is detected', async () => {
        vi.mocked(readFile).mockResolvedValue(Buffer.from([1, 2, 3]));
        vi.mocked(existsSync).mockReturnValue(true);
        const topoSkill = new TopoSkill(extensionPath, userHomePath);

        await topoSkill.install();

        expect(cp).toHaveBeenCalledWith(
            bundledDirectoryPath,
            canonicalSkillPath,
            { recursive: true, force: true },
        );
        expect(ensureSkillLink).toHaveBeenCalledWith(
            canonicalSkillPath,
            claudeSkillPath,
        );
    });

    it('installs only the canonical skill when Claude is not detected', async () => {
        vi.mocked(readFile).mockResolvedValue(Buffer.from([1, 2, 3]));
        const topoSkill = new TopoSkill(extensionPath, userHomePath);

        await topoSkill.install();

        expect(cp).toHaveBeenCalledWith(
            bundledDirectoryPath,
            canonicalSkillPath,
            { recursive: true, force: true },
        );
        expect(ensureSkillLink).not.toHaveBeenCalled();
    });

    it('detects and installs Claude through CLAUDE_CONFIG_DIR', async () => {
        const configuredClaudeHomePath = '/fake/custom-claude';
        const configuredClaudeSkillPath = path.join(
            configuredClaudeHomePath,
            'skills',
            'topo-cli-location',
        );
        vi.mocked(readFile).mockResolvedValue(Buffer.from([1, 2, 3]));
        vi.mocked(existsSync).mockReturnValue(true);
        const topoSkill = new TopoSkill(extensionPath, userHomePath, {
            CLAUDE_CONFIG_DIR: `  ${configuredClaudeHomePath}  `,
        });

        await topoSkill.install();

        expect(existsSync).toHaveBeenCalledWith(configuredClaudeHomePath);
        expect(ensureSkillLink).toHaveBeenCalledWith(
            canonicalSkillPath,
            configuredClaudeSkillPath,
        );
    });
});
