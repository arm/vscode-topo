import os from 'node:os';
import { array, create, Infer, string, type } from 'superstruct';
import { execFile } from '../util/exec';

const listedSkillSchema = type({
    name: string(),
    path: string(),
    agents: array(string()),
});
const listedSkillsSchema = array(listedSkillSchema);

export type ListedSkill = Infer<typeof listedSkillSchema>;

interface NpxSkillsOptions {
    userHomePath?: string;
    platform?: NodeJS.Platform;
}

export class NpxSkills {
    public readonly userHomePath: string;
    private readonly npx: string;

    constructor(options: NpxSkillsOptions = {}) {
        this.userHomePath = options.userHomePath ?? os.homedir();
        const platform = options.platform ?? process.platform;
        this.npx = platform === 'win32' ? 'npx.cmd' : 'npx';
    }

    public async add(
        sourcePath: string,
        agents: readonly string[],
    ): Promise<void> {
        await execFile(
            this.npx,
            [
                '--yes',
                'skills',
                'add',
                sourcePath,
                '--global',
                '--agent',
                ...agents,
                '--yes',
            ],
            this.execOptions,
        );
    }

    public async list(agents: readonly string[]): Promise<ListedSkill[]> {
        const { stdout } = await execFile(
            this.npx,
            [
                '--yes',
                'skills',
                'list',
                '--global',
                '--agent',
                ...agents,
                '--json',
            ],
            this.execOptions,
        );
        const listedSkills: unknown = JSON.parse(stdout);
        try {
            return create(listedSkills, listedSkillsSchema);
        } catch (cause) {
            throw new Error('Unexpected output from skills list', { cause });
        }
    }

    private get execOptions() {
        return {
            cwd: this.userHomePath,
            encoding: 'utf8' as const,
            windowsHide: true,
        };
    }
}
