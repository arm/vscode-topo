import os from 'node:os';
import * as vscode from 'vscode';
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

export class NpxSkills {
    private readonly userHomePath = os.homedir();
    private readonly npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

    public createAddCommand(sourcePath: string): vscode.ProcessExecution {
        return new vscode.ProcessExecution(
            this.npx,
            ['--yes', 'skills', 'add', sourcePath, '--global'],
            { cwd: this.userHomePath },
        );
    }

    public createRemoveCommand(skillName: string): vscode.ProcessExecution {
        return new vscode.ProcessExecution(
            this.npx,
            ['--yes', 'skills', 'remove', skillName, '--global', '--yes'],
            { cwd: this.userHomePath },
        );
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
