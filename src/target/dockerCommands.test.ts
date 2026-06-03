import {
    DockerCommands,
    DockerError,
    parseDockerStderr,
} from './dockerCommands';
import { execFile } from '../util/exec';
import { logger } from '../util/logger';
import { DockerInspectItem } from '../util/types';
import { WrappedError } from '../errors/wrappedError';
import type { Mock } from 'vitest';

vi.mock('../util/exec', () => ({
    execFile: vi.fn(),
}));

vi.mock('../util/logger');

const execFileMock: Mock = vi.mocked(execFile);

function makeDockerError(stdout: string, stderr: string): DockerError {
    const e = new Error('Command failed: docker something') as DockerError;
    e.stdout = stdout;
    e.stderr = stderr;
    return e;
}

describe('DockerCommands', () => {
    let dockerCommands: DockerCommands;

    beforeEach(() => {
        vi.resetAllMocks();
        // default execFile mock returns empty stdout/stderr to avoid leaking behavior between tests
        execFileMock.mockImplementation(async () => ({
            stdout: '',
            stderr: '',
        }));
        dockerCommands = new DockerCommands();
    });

    describe('getCurrentContext', () => {
        it('returns trimmed context name on success', async () => {
            execFileMock.mockResolvedValueOnce({
                stdout: 'default\n',
                stderr: '',
            });

            const ctx = await dockerCommands.getCurrentContext();

            expect(ctx).toBe('default');
            expect(execFileMock).toHaveBeenCalledWith('docker', [
                'context',
                'show',
            ]);
        });

        it('logs when stderr present', async () => {
            execFileMock.mockResolvedValueOnce({ stdout: '', stderr: 'err' });

            await dockerCommands.getCurrentContext();

            expect(logger.warn).toHaveBeenCalledWith(expect.any(String), 'err');
        });

        it('throws when exec fails', async () => {
            execFileMock.mockRejectedValueOnce(new Error('fail'));

            const getCurrentContextOperation =
                dockerCommands.getCurrentContext();

            await expect(getCurrentContextOperation).rejects.toThrow('fail');
        });
    });

    describe('getContexts', () => {
        it('parses contexts list', async () => {
            execFileMock.mockResolvedValueOnce({
                stdout: 'default\ntarget\n',
                stderr: '',
            });

            const list = await dockerCommands.getContexts();

            expect(list).toEqual(['default', 'target']);
            expect(execFileMock).toHaveBeenCalledWith('docker', [
                'context',
                'ls',
                '--format',
                '{{.Name}}',
            ]);
        });

        it('logs when stderr present', async () => {
            execFileMock.mockResolvedValueOnce({ stdout: '', stderr: 'err' });

            await dockerCommands.getContexts();

            expect(logger.warn).toHaveBeenCalledWith(expect.any(String), 'err');
        });

        it('throws when exec fails', async () => {
            execFileMock.mockRejectedValueOnce(new Error('fail'));

            const getContextsOperation = dockerCommands.getContexts();

            await expect(getContextsOperation).rejects.toThrow('fail');
        });
    });

    describe('useContext', () => {
        it('invokes docker context use', async () => {
            execFileMock.mockResolvedValueOnce({ stdout: '', stderr: '' });

            await dockerCommands.useContext('target-ctx');

            expect(execFileMock).toHaveBeenCalledWith('docker', [
                'context',
                'use',
                'target-ctx',
            ]);
        });
    });

    describe('ensureContext', () => {
        it('does nothing when context exists', async () => {
            execFileMock.mockResolvedValueOnce({
                stdout: 'a\ntarget-ctx\n',
                stderr: '',
            });

            await dockerCommands.ensureContext('target-ctx', 'user@host');

            expect(execFileMock).toHaveBeenCalledTimes(1);
        });

        it('creates context when missing', async () => {
            execFileMock
                .mockResolvedValueOnce({ stdout: 'default\n', stderr: '' })
                .mockResolvedValueOnce({ stdout: '', stderr: '' });

            await dockerCommands.ensureContext('target-ctx', 'user@host');

            expect(execFileMock).toHaveBeenCalledTimes(2);
            expect(execFileMock.mock.calls[1]).toEqual([
                'docker',
                [
                    'context',
                    'create',
                    'target-ctx',
                    '--docker',
                    'host=ssh://user@host',
                ],
            ]);
        });

        it('logs error when listing contexts fails', async () => {
            execFileMock.mockRejectedValueOnce(new Error('list-fail'));

            const ensureContextOperation = dockerCommands.ensureContext(
                'target-ctx',
                'user@host',
            );

            await expect(ensureContextOperation).rejects.toThrow('list-fail');
        });
    });

    describe('executeWithContext', () => {
        it('switches context, runs operation and restores original context after timeout', async () => {
            const op = vi.fn().mockResolvedValue('ok');
            execFileMock.mockImplementationOnce(
                async (_command: string, args: string[]) => {
                    if (args.join(' ') === 'context show') {
                        return {
                            stdout: 'orig\n',
                            stderr: '',
                        };
                    }
                    return {
                        stdout: '',
                        stderr: '',
                    };
                },
            );

            const res = await dockerCommands.executeWithContext(
                () => op(),
                'target-ctx',
                0,
            );

            expect(res).toBe('ok');
            // first call shows 'docker context show' then use then restore
            expect(execFileMock.mock.calls[0]).toEqual([
                'docker',
                ['context', 'show'],
            ]);
            expect(execFileMock.mock.calls[1]).toEqual([
                'docker',
                ['context', 'use', 'target-ctx'],
            ]);
            expect(execFileMock.mock.calls[2]).toEqual([
                'docker',
                ['context', 'use', 'orig'],
            ]);
        });

        it('still restores original context when operation throws', async () => {
            execFileMock.mockImplementationOnce(
                async (_command: string, args: string[]) => {
                    if (args.join(' ') === 'context show') {
                        return {
                            stdout: 'orig\n',
                            stderr: '',
                        };
                    }
                    return {
                        stdout: '',
                        stderr: '',
                    };
                },
            );
            const op = vi.fn().mockRejectedValue(new Error('op-fail'));

            const executeWithContextOperation =
                dockerCommands.executeWithContext(() => op(), 'target-ctx', 0);

            await expect(executeWithContextOperation).rejects.toThrow(
                'op-fail',
            );
            expect(execFileMock.mock.calls[2]).toEqual([
                'docker',
                ['context', 'use', 'orig'],
            ]);
        });
    });

    describe('getContainers', () => {
        it('parses docker ps json lines', async () => {
            const containerItem = { ID: '1', Names: 'c1' };
            execFileMock.mockResolvedValueOnce({
                stdout: `${JSON.stringify(containerItem)}\n`,
                stderr: '',
            });

            const arr = await dockerCommands.getContainers('ctx');

            expect(execFileMock).toHaveBeenCalledWith('docker', [
                '--host',
                'ssh://ctx',
                'ps',
                '-a',
                '--format',
                '{{json .}}',
            ]);
            expect(arr).toEqual([containerItem]);
        });

        it('passes target shell metacharacters as one host argument', async () => {
            execFileMock.mockResolvedValueOnce({ stdout: '\n', stderr: '' });

            await dockerCommands.getContainers('ctx; touch /tmp/pwned');

            expect(execFileMock).toHaveBeenCalledWith('docker', [
                '--host',
                'ssh://ctx; touch /tmp/pwned',
                'ps',
                '-a',
                '--format',
                '{{json .}}',
            ]);
        });

        it('returns empty array when no lines', async () => {
            execFileMock.mockResolvedValueOnce({ stdout: '\n', stderr: '' });

            const arr = await dockerCommands.getContainers('ctx');

            expect(arr).toHaveLength(0);
        });
    });

    describe('inspectContainers', () => {
        it('returns inspect output on success', async () => {
            const inspectItem: DockerInspectItem = {
                Id: 'id',
                NetworkSettings: { Ports: {} },
                HostConfig: { Runtime: 'r', Annotations: {} },
            };
            execFileMock.mockResolvedValueOnce({
                stdout: JSON.stringify(inspectItem),
                stderr: '',
            });

            const out = await dockerCommands.inspectContainers(
                ['a'],
                'user@host',
            );

            expect(out).toEqual([inspectItem]);
            expect(execFileMock).toHaveBeenCalledWith('docker', [
                '--host',
                'ssh://user@host',
                'inspect',
                'a',
                '--format',
                '{{json .}}',
            ]);
        });

        it('passes container IDs and target shell metacharacters as separate arguments', async () => {
            const inspectItem: DockerInspectItem = {
                Id: 'id',
                NetworkSettings: { Ports: {} },
                HostConfig: { Runtime: 'r', Annotations: {} },
            };
            execFileMock.mockResolvedValueOnce({
                stdout: JSON.stringify(inspectItem),
                stderr: '',
            });

            await dockerCommands.inspectContainers(
                ['a; touch /tmp/a', 'b'],
                'user@host; touch /tmp/host',
            );

            expect(execFileMock).toHaveBeenCalledWith('docker', [
                '--host',
                'ssh://user@host; touch /tmp/host',
                'inspect',
                'a; touch /tmp/a',
                'b',
                '--format',
                '{{json .}}',
            ]);
        });

        it('returns partial output when exec rejects with only not-found errors', async () => {
            const inspectItem: DockerInspectItem = {
                Id: 'id',
                NetworkSettings: { Ports: {} },
                HostConfig: { Runtime: 'r', Annotations: {} },
            };
            const err = makeDockerError(
                JSON.stringify(inspectItem),
                'Error: No such object: a\nError: No such object: b',
            );
            execFileMock.mockRejectedValueOnce(err);

            const out = await dockerCommands.inspectContainers(
                ['a', 'b'],
                'user@host',
            );

            expect(logger.warn).toHaveBeenCalledWith(
                expect.any(String),
                err.stderr,
            );
            expect(out).toEqual([inspectItem]);
        });

        it('rethrows when exec rejects with unknown error', async () => {
            const err = new Error('boom');
            execFileMock.mockRejectedValueOnce(err);

            await expect(
                dockerCommands.inspectContainers(['a'], 'ctx'),
            ).rejects.toBe(err);
        });

        it('throws a WrappedError when exec rejects with a DockerError', async () => {
            const dockerErr = makeDockerError('', 'some docker error');
            execFileMock.mockRejectedValue(dockerErr);

            await expect(
                dockerCommands.inspectContainers(['a'], 'ctx'),
            ).rejects.toThrow(WrappedError);
            await expect(
                dockerCommands.inspectContainers(['a'], 'ctx'),
            ).rejects.toThrow('some docker error');
        });

        it('returns empty array when provided with an empty array', async () => {
            const out = await dockerCommands.inspectContainers([], 'ctx');

            expect(out).toEqual([]);
            expect(execFileMock).not.toHaveBeenCalled();
        });
    });

    describe('stopContainer', () => {
        it('logs a warning when stderr present', async () => {
            execFileMock.mockResolvedValueOnce({ stdout: '', stderr: 'fail' });

            await dockerCommands.stopContainer('c', 'user@host');

            expect(logger.warn).toHaveBeenCalledWith(
                expect.any(String),
                'fail',
            );
        });

        it('succeeds when exec returns empty stderr', async () => {
            execFileMock.mockResolvedValue({ stdout: '', stderr: '' });

            await dockerCommands.stopContainer('c', 'user@host');

            expect(execFileMock).toHaveBeenCalledWith('docker', [
                '--host',
                'ssh://user@host',
                'stop',
                'c',
            ]);
        });

        it('throws an error when docker command fails', async () => {
            execFileMock.mockRejectedValueOnce(new Error('fail'));

            const stopContainerOperation = dockerCommands.stopContainer(
                'c',
                'user@host',
            );

            await expect(stopContainerOperation).rejects.toThrow('fail');
        });
    });

    describe('startContainer', () => {
        it('logs a warning when stderr present', async () => {
            execFileMock.mockResolvedValueOnce({ stdout: '', stderr: 'fail' });

            await dockerCommands.startContainer('c', 'user@host');

            expect(logger.warn).toHaveBeenCalledWith(
                expect.any(String),
                'fail',
            );
        });

        it('succeeds when exec returns empty stderr', async () => {
            execFileMock.mockResolvedValue({ stdout: '', stderr: '' });

            await dockerCommands.startContainer('c', 'user@host');

            expect(execFileMock).toHaveBeenCalledWith('docker', [
                '--host',
                'ssh://user@host',
                'start',
                'c',
            ]);
        });

        it('throws an error when docker command fails', async () => {
            execFileMock.mockRejectedValueOnce(new Error('fail'));

            const startContainerOperation = dockerCommands.startContainer(
                'c',
                'user@host',
            );

            await expect(startContainerOperation).rejects.toThrow('fail');
        });
    });

    describe('deleteContainer', () => {
        it('logs a warning when stderr present', async () => {
            execFileMock.mockResolvedValueOnce({ stdout: '', stderr: 'fail' });

            await dockerCommands.deleteContainer('c', 'ctx');

            expect(logger.warn).toHaveBeenCalledWith(
                expect.any(String),
                'fail',
            );
        });

        it('succeeds when exec returns empty stderr', async () => {
            execFileMock.mockResolvedValue({ stdout: '', stderr: '' });

            await dockerCommands.deleteContainer('c', 'user@host');

            expect(execFileMock).toHaveBeenCalledWith('docker', [
                '--host',
                'ssh://user@host',
                'rm',
                '-f',
                'c',
            ]);
        });

        it('throws an error when docker command fails', async () => {
            execFileMock.mockRejectedValueOnce(new Error('fail'));

            const deleteContainerOperation = dockerCommands.deleteContainer(
                'c',
                'user@host',
            );

            await expect(deleteContainerOperation).rejects.toThrow('fail');
        });
    });

    describe('getAttachShellCommand', () => {
        it('builds the exec command string', () => {
            const cmd = dockerCommands.getAttachShellCommand('abc', 'ctx');

            expect(cmd).toBe('docker --host ssh://ctx exec -it abc sh');
        });
    });
});

describe('parseDockerStderr', () => {
    it('classifies Error: lines as errors', () => {
        const logs = parseDockerStderr('Error: something went wrong');

        expect(logs).toEqual([
            { level: 'Error', msg: 'Error: something went wrong' },
        ]);
    });

    it('classifies Warning: lines as warnings', () => {
        const logs = parseDockerStderr('Warning: deprecated flag');

        expect(logs).toEqual([
            { level: 'Warning', msg: 'Warning: deprecated flag' },
        ]);
    });

    it('classifies unrecognised lines as errors', () => {
        const logs = parseDockerStderr('unexpected output');

        expect(logs).toEqual([{ level: 'Error', msg: 'unexpected output' }]);
    });

    it('handles mixed lines', () => {
        const stderr =
            'Error: container not found\nWarning: low disk space\nsome other message';

        const logs = parseDockerStderr(stderr);

        expect(logs).toEqual([
            { level: 'Error', msg: 'Error: container not found' },
            { level: 'Warning', msg: 'Warning: low disk space' },
            { level: 'Error', msg: 'some other message' },
        ]);
    });

    it('skips empty lines', () => {
        const logs = parseDockerStderr('Error: fail\n\n\nWarning: warn');

        expect(logs).toEqual([
            { level: 'Error', msg: 'Error: fail' },
            { level: 'Warning', msg: 'Warning: warn' },
        ]);
    });

    it('returns empty array for empty string', () => {
        const logs = parseDockerStderr('');

        expect(logs).toEqual([]);
    });
});
