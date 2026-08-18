import os from 'node:os';
import { WrappedError } from '../errors/wrappedError';
import { execFile } from '../util/exec';
import { NpxSkills } from './npxSkills';

vi.mock('../util/exec', () => ({ execFile: vi.fn() }));

describe('NpxSkills', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(execFile).mockResolvedValue({ stdout: '', stderr: '' });
    });

    it('creates the global add command', () => {
        const npxSkills = new NpxSkills();
        const command = npxSkills.createAddCommand('/fake/skill');

        expect(command).toEqual(
            expect.objectContaining({
                process: process.platform === 'win32' ? 'npx.cmd' : 'npx',
                args: ['--yes', 'skills', 'add', '/fake/skill', '--global'],
                options: { cwd: os.homedir() },
            }),
        );
    });

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
        const npxSkills = new NpxSkills();

        await expect(npxSkills.listGlobal()).resolves.toEqual(listedSkills);
        expect(execFile).toHaveBeenCalledExactlyOnceWith(
            process.platform === 'win32' ? 'npx.cmd' : 'npx',
            ['--yes', 'skills', 'list', '--global', '--json'],
            {
                cwd: os.homedir(),
                encoding: 'utf8',
                windowsHide: true,
            },
        );
    });

    it('rejects malformed list output', async () => {
        vi.mocked(execFile).mockResolvedValue({ stdout: '{}', stderr: '' });

        await expect(new NpxSkills().listGlobal()).rejects.toEqual(
            expect.objectContaining<Partial<WrappedError>>({
                name: 'WrappedError',
                code: 'SKILL',
                message: 'Unexpected output from skills list',
            }),
        );
    });
});
