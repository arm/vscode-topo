import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { WrappedError } from '../errors/wrappedError';
import { ensureSkillLink, isSkillLink } from './skillLink';

describe('ensureSkillLink', () => {
    let temporaryHome: string;
    let skillPath: string;
    let claudeSkillPath: string;

    beforeEach(async () => {
        temporaryHome = await fs.mkdtemp(
            path.join(os.tmpdir(), 'vscode-topo-skill-'),
        );
        skillPath = path.join(
            temporaryHome,
            '.agents',
            'skills',
            'topo-cli-location',
        );
        claudeSkillPath = path.join(
            temporaryHome,
            '.claude',
            'skills',
            'topo-cli-location',
        );
        await fs.mkdir(skillPath, { recursive: true });
    });

    afterEach(async () => {
        await fs.rm(temporaryHome, { recursive: true, force: true });
    });

    it('creates a relative link to the canonical skill', async () => {
        await ensureSkillLink(skillPath, claudeSkillPath);

        if (process.platform !== 'win32') {
            expect(await fs.readlink(claudeSkillPath)).toBe(
                path.relative(path.dirname(claudeSkillPath), skillPath),
            );
        }
        expect(await fs.realpath(claudeSkillPath)).toBe(
            await fs.realpath(skillPath),
        );
        await expect(isSkillLink(skillPath, claudeSkillPath)).resolves.toBe(
            true,
        );
    });

    it('replaces an existing link to a different skill', async () => {
        const otherSkillPath = path.join(temporaryHome, 'other-skill');
        await fs.mkdir(otherSkillPath);
        await fs.mkdir(path.dirname(claudeSkillPath), { recursive: true });
        await fs.symlink(
            otherSkillPath,
            claudeSkillPath,
            process.platform === 'win32' ? 'junction' : 'dir',
        );

        await expect(isSkillLink(skillPath, claudeSkillPath)).resolves.toBe(
            false,
        );

        await ensureSkillLink(skillPath, claudeSkillPath);

        expect(await fs.realpath(claudeSkillPath)).toBe(
            await fs.realpath(skillPath),
        );
    });

    it('keeps an existing link to the canonical skill', async () => {
        await ensureSkillLink(skillPath, claudeSkillPath);

        await expect(
            ensureSkillLink(skillPath, claudeSkillPath),
        ).resolves.toBeUndefined();
        expect(await fs.realpath(claudeSkillPath)).toBe(
            await fs.realpath(skillPath),
        );
    });

    it('preserves an existing non-link skill', async () => {
        await fs.mkdir(claudeSkillPath, { recursive: true });

        await expect(isSkillLink(skillPath, claudeSkillPath)).resolves.toBe(
            false,
        );

        await expect(
            ensureSkillLink(skillPath, claudeSkillPath),
        ).rejects.toEqual(
            new WrappedError(
                'SKILL',
                `Cannot link the Topo skill because ${claudeSkillPath} already exists and is not a symbolic link`,
            ),
        );
    });

    it('reports a missing link', async () => {
        await expect(isSkillLink(skillPath, claudeSkillPath)).resolves.toBe(
            false,
        );
    });
});
