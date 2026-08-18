import os from 'node:os';
import * as vscode from 'vscode';
import { array, create, Infer, string, type } from 'superstruct';
import { WrappedError } from '../errors/wrappedError';
import { execFile } from '../util/exec';
import { createTask } from '../util/task';

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

    public createAddGlobalTask(
        taskName: string,
        sourcePath: string,
    ): vscode.Task {
        const args = ['--yes', 'skills', 'add', sourcePath, '--global'];
        const execution = new vscode.ProcessExecution(this.npx, args, {
            cwd: this.userHomePath,
        });
        return createTask(taskName, execution);
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
