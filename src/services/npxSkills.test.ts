import { execFile } from '../util/exec';
import { NpxSkills } from './npxSkills';

vi.mock('../util/exec', () => ({ execFile: vi.fn() }));

describe('NpxSkills', () => {
    const userHomePath = '/fake/home';

    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(execFile).mockResolvedValue({ stdout: '', stderr: '' });
    });

    it('adds a global skill for all requested agents', async () => {
        const npxSkills = new NpxSkills({
            userHomePath,
            platform: 'linux',
        });

        await npxSkills.add('/fake/skill', ['codex', 'claude-code']);

        expect(execFile).toHaveBeenCalledExactlyOnceWith(
            'npx',
            [
                '--yes',
                'skills',
                'add',
                '/fake/skill',
                '--global',
                '--agent',
                'codex',
                'claude-code',
                '--yes',
            ],
            {
                cwd: userHomePath,
                encoding: 'utf8',
                windowsHide: true,
            },
        );
    });

    it('lists global skills as structured data', async () => {
        const listedSkills = [
            {
                name: 'topo-cli-location',
                path: '/fake/skill',
                agents: ['Codex'],
            },
        ];
        vi.mocked(execFile).mockResolvedValue({
            stdout: JSON.stringify(listedSkills),
            stderr: '',
        });
        const npxSkills = new NpxSkills({
            userHomePath,
            platform: 'win32',
        });

        await expect(npxSkills.list(['codex'])).resolves.toEqual(listedSkills);
        expect(execFile).toHaveBeenCalledExactlyOnceWith(
            'npx.cmd',
            [
                '--yes',
                'skills',
                'list',
                '--global',
                '--agent',
                'codex',
                '--json',
            ],
            {
                cwd: userHomePath,
                encoding: 'utf8',
                windowsHide: true,
            },
        );
    });

    it('rejects malformed list output', async () => {
        vi.mocked(execFile).mockResolvedValue({
            stdout: '{}',
            stderr: '',
        });
        const npxSkills = new NpxSkills({ userHomePath });

        await expect(npxSkills.list(['codex'])).rejects.toThrow(
            'Unexpected output from skills list',
        );
    });
});
