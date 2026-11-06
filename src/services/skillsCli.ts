import os from 'node:os';
import * as vscode from 'vscode';
import { array, create, Infer, string, type } from 'superstruct';
import { WrappedError } from '../errors/wrappedError';
import { execFile } from '../util/exec';
import { shellQuote } from '../util/task';

const listedSkillSchema = type({
    name: string(),
    path: string(),
    agents: array(string()),
});
const listedSkillsSchema = array(listedSkillSchema);

export type ListedSkill = Infer<typeof listedSkillSchema>;

export class SkillsCli {
    private readonly userHomePath = os.homedir();
    private readonly cliPath: string;

    constructor(extensionUri: vscode.Uri) {
        this.cliPath = vscode.Uri.joinPath(
            extensionUri,
            'node_modules',
            'skills',
            'bin',
            'cli.mjs',
        ).fsPath;
    }

    public createAddCommand(sourcePath: string): vscode.ShellExecution {
        return this.createCommand(['add', shellQuote(sourcePath), '--global']);
    }

    public createRemoveCommand(skillName: string): vscode.ShellExecution {
        return this.createCommand([
            'remove',
            shellQuote(skillName),
            '--global',
            '--yes',
        ]);
    }

    private createCommand(
        args: (string | vscode.ShellQuotedString)[],
    ): vscode.ShellExecution {
        return new vscode.ShellExecution(
            shellQuote(process.execPath),
            [shellQuote(this.cliPath), ...args],
            {
                cwd: this.userHomePath,
                env: { ELECTRON_RUN_AS_NODE: '1' },
            },
        );
    }

    public async listGlobal(): Promise<ListedSkill[]> {
        const { stdout } = await execFile(
            process.execPath,
            [this.cliPath, 'list', '--global', '--json'],
            {
                cwd: this.userHomePath,
                // Desktop VS Code supplies Electron; remote hosts supply Node.
                env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
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
