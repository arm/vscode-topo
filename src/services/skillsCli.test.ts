import os from 'node:os';
import * as vscode from 'vscode';
import { execFile } from '../util/exec';
import { SkillsCli } from './skillsCli';

vi.mock('../util/exec', () => ({ execFile: vi.fn() }));

describe('SkillsCli', () => {
    const extensionUri = vscode.Uri.file('/fake/extension with spaces');
    const cliPath = vscode.Uri.joinPath(
        extensionUri,
        'node_modules/skills/bin/cli.mjs',
    ).fsPath;
    const skillsCli = new SkillsCli(extensionUri);

    beforeEach(() => {
        vi.resetAllMocks();
    });

    it.each([
        ['add', 'createAddCommand', '/fake/skill with $spaces', ['--global']],
        [
            'remove',
            'createRemoveCommand',
            'topo-cli-location',
            ['--global', '--yes'],
        ],
    ] as const)(
        'creates the global %s task with quoted paths',
        (action, method, value, flags) => {
            expect(skillsCli[method](value)).toMatchObject({
                command: {
                    value: process.execPath,
                    quoting: vscode.ShellQuoting.Strong,
                },
                args: [
                    { value: cliPath, quoting: vscode.ShellQuoting.Strong },
                    action,
                    {
                        value,
                        quoting: vscode.ShellQuoting.Strong,
                    },
                    ...flags,
                ],
                options: {
                    cwd: os.homedir(),
                    env: { ELECTRON_RUN_AS_NODE: '1' },
                },
            });
        },
    );

    it('lists global skills as structured data', async () => {
        const listedSkills = [
            {
                name: 'topo-cli-location',
                path: '/fake/skill',
                agents: ['Codex', 'OpenCode'],
                scope: 'global',
                source: null,
            },
        ];
        vi.mocked(execFile).mockResolvedValue({
            stdout: JSON.stringify(listedSkills),
            stderr: '',
        });

        await expect(skillsCli.listGlobal()).resolves.toEqual(listedSkills);
        expect(execFile).toHaveBeenCalledExactlyOnceWith(
            process.execPath,
            [cliPath, 'list', '--global', '--json'],
            {
                cwd: os.homedir(),
                env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
                encoding: 'utf8',
                windowsHide: true,
            },
        );
    });

    it('rejects malformed list output', async () => {
        vi.mocked(execFile).mockResolvedValue({ stdout: '{}', stderr: '' });

        await expect(skillsCli.listGlobal()).rejects.toMatchObject({
            code: 'SKILL',
            message: 'Unexpected output from skills list',
        });
    });

    it('reports errors launching the bundled CLI', async () => {
        const error = new Error('permission denied');
        vi.mocked(execFile).mockRejectedValue(error);

        await expect(skillsCli.listGlobal()).rejects.toBe(error);
    });
});
