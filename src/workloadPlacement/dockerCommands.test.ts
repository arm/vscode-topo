import { DockerCommands, DockerError } from './dockerCommands';
import { exec } from '../util/exec';
import { logger } from '../util/logger';
import { TopoError } from '../errors/topoError';

jest.mock('../util/exec', () => ({
    exec: jest.fn(),
}));

jest.mock('../util/logger');

const execMock: jest.Mock = jest.mocked(exec);

function makeDockerError(stdout: string, stderr: string): DockerError {
    const e = new Error('Command failed: docker something') as DockerError;
    e.stdout = stdout;
    e.stderr = stderr;
    return e;
}

describe('DockerCommands', () => {
    let dockerCommands: DockerCommands;

    beforeEach(() => {
        jest.resetAllMocks();
        // default exec mock returns empty stdout/stderr to avoid leaking behavior between tests
        execMock.mockImplementation(async () => ({ stdout: '', stderr: '' }));
        dockerCommands = new DockerCommands();
    });

    describe('getCurrentContext', () => {
        it('returns trimmed context name on success', async () => {
            execMock.mockResolvedValueOnce({ stdout: 'default\n', stderr: '' });

            const ctx = await dockerCommands.getCurrentContext();

            expect(ctx).toBe('default');
            expect(execMock).toHaveBeenCalledWith('docker context show');
        });

        it('logs when stderr present', async () => {
            execMock.mockResolvedValueOnce({ stdout: '', stderr: 'err' });

            await dockerCommands.getCurrentContext();

            expect(logger.warn).toHaveBeenCalledWith(expect.any(String), 'err');
        });

        it('throws when exec fails', async () => {
            execMock.mockRejectedValueOnce(new Error('fail'));

            const getCurrentContextOperation =
                dockerCommands.getCurrentContext();

            await expect(getCurrentContextOperation).rejects.toThrow('fail');
        });
    });

    describe('getContexts', () => {
        it('parses contexts list', async () => {
            execMock.mockResolvedValueOnce({
                stdout: 'default\nboard\n',
                stderr: '',
            });

            const list = await dockerCommands.getContexts();

            expect(list).toEqual(['default', 'board']);
            expect(execMock).toHaveBeenCalledWith(
                "docker context ls --format '{{.Name}}'",
            );
        });

        it('logs when stderr present', async () => {
            execMock.mockResolvedValueOnce({ stdout: '', stderr: 'err' });

            await dockerCommands.getContexts();

            expect(logger.warn).toHaveBeenCalledWith(expect.any(String), 'err');
        });

        it('throws when exec fails', async () => {
            execMock.mockRejectedValueOnce(new Error('fail'));

            const getContextsOperation = dockerCommands.getContexts();

            await expect(getContextsOperation).rejects.toThrow('fail');
        });
    });

    describe('useContext', () => {
        it('invokes docker context use', async () => {
            execMock.mockResolvedValueOnce({ stdout: '', stderr: '' });

            await dockerCommands.useContext('board-ctx');

            expect(execMock).toHaveBeenCalledWith(
                'docker context use board-ctx',
            );
        });
    });

    describe('ensureContext', () => {
        it('does nothing when context exists', async () => {
            execMock.mockResolvedValueOnce({
                stdout: 'a\nboard-ctx\n',
                stderr: '',
            });

            await dockerCommands.ensureContext('board-ctx', 'user@host');

            expect(execMock).toHaveBeenCalledTimes(1);
        });

        it('creates context when missing', async () => {
            execMock
                .mockResolvedValueOnce({ stdout: 'default\n', stderr: '' })
                .mockResolvedValueOnce({ stdout: '', stderr: '' });

            await dockerCommands.ensureContext('board-ctx', 'user@host');

            expect(execMock).toHaveBeenCalledTimes(2);
            expect(execMock.mock.calls[1][0]).toContain(
                `docker context create board-ctx`,
            );
        });

        it('logs error when listing contexts fails', async () => {
            execMock.mockRejectedValueOnce(new Error('list-fail'));

            const ensureContextOperation = dockerCommands.ensureContext(
                'board-ctx',
                'user@host',
            );

            await expect(ensureContextOperation).rejects.toThrow('list-fail');
        });
    });

    describe('executeWithContext', () => {
        it('switches context, runs operation and restores original context after timeout', async () => {
            const op = jest.fn().mockResolvedValue('ok');
            execMock.mockImplementationOnce(async (cmd: string) => {
                if (cmd === 'docker context show') {
                    return {
                        stdout: 'orig\n',
                        stderr: '',
                    };
                }
                return { stdout: '', stderr: '' };
            });

            const res = await dockerCommands.executeWithContext(
                () => op(),
                'board-ctx',
                0,
            );

            expect(res).toBe('ok');
            // first call shows 'docker context show' then use then restore
            expect(execMock.mock.calls[0][0]).toBe('docker context show');
            expect(execMock.mock.calls[1][0]).toBe(
                'docker context use board-ctx',
            );
            expect(execMock.mock.calls[2][0]).toBe('docker context use orig');
        });

        it('still restores original context when operation throws', async () => {
            execMock.mockImplementationOnce(async (cmd: string) => {
                if (cmd === 'docker context show') {
                    return {
                        stdout: 'orig\n',
                        stderr: '',
                    };
                }
                return { stdout: '', stderr: '' };
            });
            const op = jest.fn().mockRejectedValue(new Error('op-fail'));

            const executeWithContextOperation =
                dockerCommands.executeWithContext(() => op(), 'board-ctx', 0);

            await expect(executeWithContextOperation).rejects.toThrow(
                'op-fail',
            );
            expect(execMock.mock.calls[2][0]).toContain(
                'docker context use orig',
            );
        });
    });

    describe('getContainers', () => {
        it('parses docker ps json lines', async () => {
            const item = JSON.stringify({ ID: '1', Names: 'c1' });
            execMock.mockResolvedValueOnce({ stdout: `${item}\n`, stderr: '' });

            const arr = await dockerCommands.getContainers('ctx');

            const expectedCall =
                'docker --host ssh://ctx ps -a --format "{{json .}}"';
            expect(execMock).toHaveBeenCalledWith(expectedCall);
            expect(arr).toHaveLength(1);
            expect(arr[0].ID).toBe('1');
        });

        it('returns empty array when no lines', async () => {
            execMock.mockResolvedValueOnce({ stdout: '\n', stderr: '' });

            const arr = await dockerCommands.getContainers('ctx');

            expect(arr).toHaveLength(0);
        });
    });

    describe('inspectContainers', () => {
        it('returns inspect output on success', async () => {
            execMock.mockResolvedValueOnce({
                stdout: JSON.stringify({
                    Id: 'id',
                    NetworkSettings: { Ports: {} },
                    HostConfig: { Runtime: 'r', Annotations: {} },
                }),
                stderr: '',
            });

            const out = await dockerCommands.inspectContainers(
                ['a'],
                'user@host',
            );

            const expectedOutput = [
                {
                    HostConfig: { Annotations: {}, Runtime: 'r' },
                    Id: 'id',
                    NetworkSettings: { Ports: {} },
                },
            ];
            expect(out).toEqual(expectedOutput);
        });

        it('returns partial output when exec rejects with only not-found errors', async () => {
            const err = makeDockerError(
                JSON.stringify({
                    Id: 'id',
                    NetworkSettings: { Ports: {} },
                    HostConfig: { Runtime: 'r', Annotations: {} },
                }),
                'Error: No such object: a\nError: No such object: b',
            );
            execMock.mockRejectedValueOnce(err);

            const out = await dockerCommands.inspectContainers(
                ['a', 'b'],
                'user@host',
            );

            const expectedOutput = [
                {
                    HostConfig: { Annotations: {}, Runtime: 'r' },
                    Id: 'id',
                    NetworkSettings: { Ports: {} },
                },
            ];
            expect(logger.warn).toHaveBeenCalledWith(
                expect.any(String),
                err.stderr,
            );
            expect(out).toEqual(expectedOutput);
        });

        it('rethrows when exec rejects with unknown error', async () => {
            const err = new Error('boom');
            execMock.mockRejectedValueOnce(err);

            await expect(
                dockerCommands.inspectContainers(['a'], 'ctx'),
            ).rejects.toBe(err);
        });

        it('throws a TopoError when exec rejects with a DockerError', async () => {
            const dockerErr = makeDockerError('', 'some docker error');
            execMock.mockRejectedValue(dockerErr);

            await expect(
                dockerCommands.inspectContainers(['a'], 'ctx'),
            ).rejects.toThrow(TopoError);
            await expect(
                dockerCommands.inspectContainers(['a'], 'ctx'),
            ).rejects.toThrow('some docker error');
        });

        it('returns empty array when provided with an empty array', async () => {
            const out = await dockerCommands.inspectContainers([], 'ctx');

            expect(out).toEqual([]);
            expect(execMock).not.toHaveBeenCalled();
        });
    });

    describe('containerStats', () => {
        it('returns trimmed stats stdout on success', async () => {
            execMock.mockResolvedValueOnce({ stdout: 's1\n', stderr: '' });

            const out = await dockerCommands.containerStats(['a'], 'user@host');

            expect(out).toBe('s1');
            const expectedCall =
                "docker --host ssh://user@host stats a --no-stream --no-trunc --format '{{.ID}};{{.CPUPerc}};{{.MemUsage}}'";
            expect(execMock).toHaveBeenCalledWith(expectedCall);
        });

        it('returns err.stdout when exec rejects with only not-found errors', async () => {
            const err = makeDockerError(
                'fallback-stats',
                'Error: No such object: a',
            );
            execMock.mockRejectedValueOnce(err);

            const out = await dockerCommands.containerStats(['a'], 'user@host');

            expect(out).toBe('fallback-stats');
            expect(logger.warn).toHaveBeenCalledWith(
                expect.any(String),
                err.stderr,
            );
        });

        it('rethrows when exec rejects with unknown error', async () => {
            const err = new Error('boom');
            execMock.mockRejectedValueOnce(err);

            const containerStatsOperation = dockerCommands.containerStats(
                ['a'],
                'ctx',
            );

            await expect(containerStatsOperation).rejects.toBe(err);
        });

        it('throws a TopoError when exec rejects with a DockerError', async () => {
            const dockerErr = makeDockerError('', 'some docker error');
            execMock.mockRejectedValue(dockerErr);

            await expect(
                dockerCommands.containerStats(['a'], 'ctx'),
            ).rejects.toThrow(TopoError);
            await expect(
                dockerCommands.containerStats(['a'], 'ctx'),
            ).rejects.toThrow('some docker error');
        });

        it('returns empty string when provided with an empty array', async () => {
            const out = await dockerCommands.containerStats([], 'ctx');

            expect(out).toBe('');
            expect(execMock).not.toHaveBeenCalled();
        });
    });

    describe('stopContainer', () => {
        it('logs a warning when stderr present', async () => {
            execMock.mockResolvedValueOnce({ stdout: '', stderr: 'fail' });

            await dockerCommands.stopContainer('c', 'user@host');

            expect(logger.warn).toHaveBeenCalledWith(
                expect.any(String),
                'fail',
            );
        });

        it('succeeds when exec returns empty stderr', async () => {
            execMock.mockResolvedValue({ stdout: '', stderr: '' });

            await dockerCommands.stopContainer('c', 'user@host');

            expect(execMock).toHaveBeenCalledWith(
                'docker --host ssh://user@host stop c',
            );
        });

        it('throws an error when docker command fails', async () => {
            execMock.mockRejectedValueOnce(new Error('fail'));

            const stopContainerOperation = dockerCommands.stopContainer(
                'c',
                'user@host',
            );

            await expect(stopContainerOperation).rejects.toThrow('fail');
        });
    });

    describe('startContainer', () => {
        it('logs a warning when stderr present', async () => {
            execMock.mockResolvedValueOnce({ stdout: '', stderr: 'fail' });

            await dockerCommands.startContainer('c', 'user@host');

            expect(logger.warn).toHaveBeenCalledWith(
                expect.any(String),
                'fail',
            );
        });

        it('succeeds when exec returns empty stderr', async () => {
            execMock.mockResolvedValue({ stdout: '', stderr: '' });

            await dockerCommands.startContainer('c', 'user@host');

            expect(execMock).toHaveBeenCalledWith(
                'docker --host ssh://user@host start c',
            );
        });

        it('throws an error when docker command fails', async () => {
            execMock.mockRejectedValueOnce(new Error('fail'));

            const startContainerOperation = dockerCommands.startContainer(
                'c',
                'user@host',
            );

            await expect(startContainerOperation).rejects.toThrow('fail');
        });
    });

    describe('deleteContainer', () => {
        it('logs a warning when stderr present', async () => {
            execMock.mockResolvedValueOnce({ stdout: '', stderr: 'fail' });

            await dockerCommands.deleteContainer('c', 'ctx');

            expect(logger.warn).toHaveBeenCalledWith(
                expect.any(String),
                'fail',
            );
        });

        it('succeeds when exec returns empty stderr', async () => {
            execMock.mockResolvedValue({ stdout: '', stderr: '' });

            await dockerCommands.deleteContainer('c', 'user@host');

            expect(execMock).toHaveBeenCalledWith(
                'docker --host ssh://user@host rm -f c',
            );
        });

        it('throws an error when docker command fails', async () => {
            execMock.mockRejectedValueOnce(new Error('fail'));

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
