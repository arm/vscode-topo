import os from 'node:os';
import { array, create, Infer, string, type } from 'superstruct';
import { WrappedError } from '../errors/wrappedError';
import { execFile } from '../util/exec';

const listedSkillSchema = type({
    name: string(),
    path: string(),
    agents: array(string()),
});
const listedSkillsSchema = array(listedSkillSchema);

export type ListedSkill = Infer<typeof listedSkillSchema>;

export interface ProcessCommand {
    readonly executable: string;
    readonly arguments: readonly string[];
    readonly cwd: string;
}

export class NpxSkills {
    private readonly userHomePath = os.homedir();
    private readonly npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

    public createAddCommand(sourcePath: string): ProcessCommand {
        return {
            executable: this.npx,
            arguments: ['--yes', 'skills', 'add', sourcePath, '--global'],
            cwd: this.userHomePath,
        };
    }

    public async listGlobal(): Promise<ListedSkill[]> {
        const { stdout } = await execFile(
            this.npx,
            ['--yes', 'skills', 'list', '--global', '--json'],
            {
                cwd: this.userHomePath,
                encoding: 'utf8',
                windowsHide: true,
            },
        );

        try {
            return create(JSON.parse(stdout), listedSkillsSchema);
        } catch (cause) {
            throw new WrappedError(
                'SKILL',
                'Unexpected output from skills list',
                [],
                { cause },
            );
        }
    }
}
