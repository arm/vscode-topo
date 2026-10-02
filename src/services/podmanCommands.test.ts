import { execFile } from '../util/exec';
import { PodmanCommands } from './podmanCommands';

vi.mock('../util/exec', () => ({ execFile: vi.fn() }));
vi.mock('../util/logger');

describe('PodmanCommands', () => {
    const commands = new PodmanCommands();

    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(execFile).mockResolvedValue({ stdout: '', stderr: '' });
    });

    it.each([
        ['startContainer', ['start', '--', 'cid']],
        ['stopContainer', ['stop', '--', 'cid']],
        ['deleteContainer', ['rm', '-f', '--', 'cid']],
    ] as const)('%s uses local Podman for localhost', async (method, args) => {
        await commands[method]('cid', 'localhost');

        expect(execFile).toHaveBeenCalledExactlyOnceWith('podman', args);
    });

    it('uses a login shell and quotes remote command arguments', async () => {
        await commands.stopContainer("id'; echo unexpected", 'user@board:2222');

        expect(execFile).toHaveBeenCalledWith('ssh', [
            '-T',
            '-o',
            'BatchMode=yes',
            '--',
            'ssh://user@board:2222',
            "/bin/sh -c 'exec \"${SHELL:-/bin/sh}\" -l -c \"$1\"' sh ''\\''podman'\\'' '\\''stop'\\'' '\\''--'\\'' '\\''id'\\''\\'\\'''\\''; echo unexpected'\\'''",
        ]);
    });

    it.each(['localhost', 'LOCALHOST', '127.0.0.1'])(
        'opens local shells for %s',
        (target) => {
            expect(commands.getAttachShellCommand('cid', target)).toEqual([
                'podman',
                'exec',
                '-it',
                '--',
                'cid',
                'sh',
            ]);
        },
    );

    it('opens a login shell over SSH for an explicit user and port', () => {
        expect(
            commands.getAttachShellCommand('cid', 'root@localhost:2222'),
        ).toEqual([
            'ssh',
            '-t',
            '--',
            'ssh://root@localhost:2222',
            "/bin/sh -c 'exec \"${SHELL:-/bin/sh}\" -l -c \"$1\"' sh ''\\''podman'\\'' '\\''exec'\\'' '\\''-it'\\'' '\\''--'\\'' '\\''cid'\\'' '\\''sh'\\'''",
        ]);
    });

    it('preserves remote command diagnostics as a Podman error', async () => {
        const error = Object.assign(new Error('Command failed'), {
            stderr: 'Error: container not found\n',
        });
        vi.mocked(execFile).mockRejectedValueOnce(error);

        await expect(
            commands.stopContainer('cid', 'user@board'),
        ).rejects.toMatchObject({
            code: 'PODMAN',
            message: 'Error: container not found',
            cause: error,
        });
    });

    it('reports a missing executable even without stderr', async () => {
        vi.mocked(execFile).mockRejectedValueOnce(
            new Error('spawn podman ENOENT'),
        );

        await expect(
            commands.startContainer('cid', 'localhost'),
        ).rejects.toMatchObject({
            code: 'PODMAN',
            message: 'spawn podman ENOENT',
        });
    });
});
