import { existsSync } from 'node:fs';
import { cp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { WrappedError } from '../errors/wrappedError';
import { ensureSkillLink, isSkillLink } from '../util/skillLink';
import { skillPaths } from '../util/skillPaths';
import { TopoSkillStatus } from '../util/types';

export const TOPO_SKILL_NAME = skillPaths.skillName;

const SKILL_FILE_NAME = 'SKILL.md';

export class TopoSkill {
    private readonly bundledDirectoryPath: string;
    private readonly canonicalSkillPath: string;
    private readonly claudeHomePath: string;
    private readonly claudeSkillPath: string;

    constructor(
        extensionPath: string,
        userHomePath = os.homedir(),
        environment: NodeJS.ProcessEnv = process.env,
    ) {
        this.bundledDirectoryPath = path.join(
            extensionPath,
            'skills',
            TOPO_SKILL_NAME,
        );
        this.canonicalSkillPath = path.join(
            userHomePath,
            ...skillPaths.canonicalSkillPath,
        );
        const configuredClaudeHome = environment.CLAUDE_CONFIG_DIR?.trim();
        this.claudeHomePath = configuredClaudeHome
            ? configuredClaudeHome
            : path.join(userHomePath, '.claude');
        this.claudeSkillPath = path.join(
            this.claudeHomePath,
            'skills',
            TOPO_SKILL_NAME,
        );
    }

    public async getStatus(): Promise<TopoSkillStatus> {
        const bundledSkill = await readFile(
            path.join(this.bundledDirectoryPath, SKILL_FILE_NAME),
        );

        let installedSkill: Buffer;
        try {
            installedSkill = await readFile(
                path.join(this.canonicalSkillPath, SKILL_FILE_NAME),
            );
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return 'missing';
            }
            throw error;
        }

        if (!bundledSkill.equals(installedSkill)) {
            return 'outdated';
        }

        if (!existsSync(this.claudeHomePath)) {
            return 'installed';
        }

        return (await isSkillLink(
            this.canonicalSkillPath,
            this.claudeSkillPath,
        ))
            ? 'installed'
            : 'outdated';
    }

    public async install(): Promise<void> {
        await cp(this.bundledDirectoryPath, this.canonicalSkillPath, {
            recursive: true,
            force: true,
        });
        if (existsSync(this.claudeHomePath)) {
            await ensureSkillLink(
                this.canonicalSkillPath,
                this.claudeSkillPath,
            );
        }
        const status = await this.getStatus();
        if (status !== 'installed') {
            throw new WrappedError(
                'SKILL',
                `Skill installation verification failed: ${status}`,
            );
        }
    }
}
