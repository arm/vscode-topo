import { DockerCommands } from './dockerCommands';
import { exec } from '../util/exec';
import { logger } from '../util/logger';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('../util/exec', () => ({
    exec: jest.fn()
}));

jest.mock('../util/logger', () => ({
    logger: {
        error: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
        show: jest.fn(),
    }
}));

const execMock: any = exec as any;

describe('DockerCommands', () => {
    let dockerCommands: DockerCommands;

    beforeEach(() => {
        jest.resetAllMocks();
        // default exec mock returns empty stdout/stderr to avoid leaking behavior between tests
        execMock.mockImplementation(async () => ({ stdout: '', stderr: '' }));
        dockerCommands = new DockerCommands();
    });

    describe('isContainerRuntimeOn', () => {
        it('returns true when docker info stdout contains Server Version and no stderr', async () => {
            execMock.mockResolvedValueOnce({ stdout: 'Server Version: 20.10', stderr: '' });

            const res = await dockerCommands.isContainerRuntimeOn('user@host');

            expect(res).toBe(true);
            expect(execMock).toHaveBeenCalledWith("ssh user@host 'docker info'");
        });

        it('returns false and logs when exec throws', async () => {
            execMock.mockRejectedValueOnce(new Error('boom'));

            const res = await dockerCommands.isContainerRuntimeOn('user@host');

            expect(res).toBe(false);
            expect(logger.error).toHaveBeenCalled();
        });

        it('returns false when stderr non-empty', async () => {
            execMock.mockResolvedValueOnce({ stdout: '', stderr: 'some error' });

            const res = await dockerCommands.isContainerRuntimeOn('user@host');

            expect(res).toBe(false);
        });
    });

    describe('getCurrentContext', () => {
        it('returns trimmed context name on success', async () => {
            execMock.mockResolvedValueOnce({ stdout: 'default\n', stderr: '' });

            const ctx = await dockerCommands.getCurrentContext();

            expect(ctx).toBe('default');
            expect(execMock).toHaveBeenCalledWith('docker context show');
        });

        it('throws when stderr present', async () => {
            execMock.mockResolvedValueOnce({ stdout: '', stderr: 'err' });

            const getCurrentContextOperation = dockerCommands.getCurrentContext();

            await expect(getCurrentContextOperation).rejects.toThrow('err');
        });
    });

    describe('getContexts', () => {
        it('parses contexts list', async () => {
            execMock.mockResolvedValueOnce({ stdout: 'default\nboard\n', stderr: '' });

            const list = await dockerCommands.getContexts();

            expect(list).toEqual(['default', 'board']);
            expect(execMock).toHaveBeenCalledWith("docker context ls --format '{{.Name}}'");
        });

        it('throws when stderr present', async () => {
            execMock.mockResolvedValueOnce({ stdout: '', stderr: 'err' });

            const getContextsOperation = dockerCommands.getContexts();

            await expect(getContextsOperation).rejects.toThrow('err');
        });
    });

    describe('useContext', () => {
        it('invokes docker context use', async () => {
            execMock.mockResolvedValueOnce({ stdout: '', stderr: '' });

            await dockerCommands.useContext('board-ctx');

            expect(execMock).toHaveBeenCalledWith('docker context use board-ctx');
        });
    });

    describe('ensureContext', () => {
        it('does nothing when context exists', async () => {
            execMock.mockResolvedValueOnce({ stdout: 'a\nboard-ctx\n', stderr: '' });

            await dockerCommands.ensureContext('board-ctx', 'user@host');

            expect(execMock).toHaveBeenCalledTimes(1);
        });

        it('creates context when missing', async () => {
            execMock
                .mockResolvedValueOnce({ stdout: 'default\n', stderr: '' })
                .mockResolvedValueOnce({ stdout: '', stderr: '' });

            await dockerCommands.ensureContext('board-ctx', 'user@host');

            expect(execMock).toHaveBeenCalledTimes(2);
            expect(execMock.mock.calls[1][0]).toContain(`docker context create board-ctx`);
        });

        it('logs error when listing contexts fails', async () => {
            execMock.mockRejectedValueOnce(new Error('list-fail'));

            const ensureContextOperation = dockerCommands.ensureContext('board-ctx', 'user@host');

            await expect(ensureContextOperation).rejects.toThrow();
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe('executeWithContext', () => {
        it('switches context, runs operation and restores original context after timeout', async () => {
            const op = jest.fn().mockResolvedValue('ok');
            execMock.mockImplementationOnce(async (cmd: string) => {
                if (cmd === 'docker context show') {
                    return {
                        stdout: 'orig\n',
                        stderr: ''
                    } as any;
                }
                return { stdout: '', stderr: '' } as any;
            });

            const res = await dockerCommands.executeWithContext(() => op(), 'board-ctx', 0);

            expect(res).toBe('ok');
            // first call shows 'docker context show' then use then restore
            expect(execMock.mock.calls[0][0]).toBe('docker context show');
            expect(execMock.mock.calls[1][0]).toBe('docker context use board-ctx');
            expect(execMock.mock.calls[2][0]).toBe('docker context use orig');
        });

        it('still restores original context when operation throws', async () => {
            execMock.mockImplementationOnce(async (cmd: string) => {
                if (cmd === 'docker context show') {
                    return {
                        stdout: 'orig\n',
                        stderr: ''
                    } as any;
                }
                return { stdout: '', stderr: '' } as any;
            });
            const op = jest.fn().mockRejectedValue(new Error('op-fail'));

            const executeWithContextOperation = dockerCommands.executeWithContext(() => op(), 'board-ctx', 0);

            await expect(executeWithContextOperation).rejects.toThrow('op-fail');
            expect(execMock.mock.calls[2][0]).toContain('docker context use orig');
        });
    });

    describe('getContainers', () => {
        it('parses docker ps json lines', async () => {
            const item = JSON.stringify({ ID: '1', Names: 'c1' });
            execMock.mockResolvedValueOnce({ stdout: `${item}\n`, stderr: '' });

            const arr = await dockerCommands.getContainers('ctx');

            const expectedCall = 'docker --host ssh://ctx ps -a --format "{{json .}}"';
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
        it('returns inspect stdout on success', async () => {
            execMock.mockResolvedValueOnce({ stdout: 'id;{};r', stderr: '' });

            const out = await dockerCommands.inspectContainers(['a'], 'user@host');

            expect(out).toBe('id;{};r');
            const expectedCall = "docker --host ssh://user@host inspect a --format '{{.Id}};{{json .NetworkSettings.Ports}};{{.HostConfig.Runtime}}'";
            expect(execMock).toHaveBeenCalledWith(expectedCall);
        });

        it('returns err.stdout when exec rejects with only not-found errors', async () => {
            const err: any = new Error('one');
            err.stderr = 'Error: No such object: a\nError: No such object: b';
            err.stdout = 'fallback';
            execMock.mockRejectedValueOnce(err);

            const out = await dockerCommands.inspectContainers(['a', 'b'], 'user@host');

            expect(out).toBe('fallback');
            expect(logger.error).toHaveBeenCalled();
        });

        it('rethrows when exec rejects with anything other than "not found" error', async () => {
            const err: any = new Error('boom');
            err.stderr = 'Something bad';
            err.stdout = 'x';
            execMock.mockRejectedValueOnce(err);

            await expect(dockerCommands.inspectContainers(['a'], 'ctx')).rejects.toBe(err);
        });

        it('returns empty string when provided with an empty array', async () => {
            const out = await dockerCommands.inspectContainers([], 'ctx');

            expect(out).toBe('');
            expect(execMock).not.toHaveBeenCalled();
        });
    });

    describe('containerStats', () => {
        it('returns trimmed stats stdout on success', async () => {
            execMock.mockResolvedValueOnce({ stdout: 's1\n', stderr: '' });

            const out = await dockerCommands.containerStats(['a'], 'user@host');

            expect(out).toBe('s1');
            const expectedCall = "docker --host ssh://user@host stats a --no-stream --no-trunc --format '{{.ID}};{{.CPUPerc}};{{.MemUsage}}'";
            expect(execMock).toHaveBeenCalledWith(expectedCall);
        });

        it('returns err.stdout when exec rejects with only not-found errors', async () => {
            const err: any = new Error('one');
            err.stderr = 'Error: No such object: a';
            err.stdout = 'fallback-stats';
            execMock.mockRejectedValueOnce(err);

            const out = await dockerCommands.containerStats(['a'], 'user@host');

            expect(out).toBe('fallback-stats');
            expect(logger.error).toHaveBeenCalled();
        });

        it('rethrows when exec rejects with other stderr', async () => {
            const err: any = new Error('boom');
            err.stderr = 'Other error';
            err.stdout = 'x';
            execMock.mockRejectedValueOnce(err);

            const containerStatsOperation = dockerCommands.containerStats(['a'], 'ctx');

            await expect(containerStatsOperation).rejects.toBe(err);
        });

        it('returns empty string when provided with an empty array', async () => {
            const out = await dockerCommands.containerStats([], 'ctx');

            expect(out).toBe('');
            expect(execMock).not.toHaveBeenCalled();
        });
    });

    describe('stopContainer', () => {
        it('throws when stderr present', async () => {
            execMock.mockResolvedValueOnce({ stdout: '', stderr: 'fail' });

            const stopContainerOperation = dockerCommands.stopContainer('c', 'user@host');

            await expect(stopContainerOperation).rejects.toThrow('fail');
        });

        it('succeeds when exec returns empty stderr', async () => {
            execMock.mockResolvedValue({ stdout: '', stderr: '' });

            const stopContainerOperation = dockerCommands.stopContainer('c', 'user@host');

            await expect(stopContainerOperation).resolves.toBeUndefined();
            expect(execMock).toHaveBeenCalledWith("docker --host ssh://user@host stop c");
        });

        it('throws an error when docker command fails', async () => {
            execMock.mockRejectedValueOnce(new Error('fail'));

            const stopContainerOperation = dockerCommands.stopContainer('c', 'user@host');

            await expect(stopContainerOperation).rejects.toThrow('fail');
        });
    });

    describe('startContainer', () => {
        it('throws when stderr present', async () => {
            execMock.mockResolvedValueOnce({ stdout: '', stderr: 'fail' });

            const startContainerOperation = dockerCommands.startContainer('c', 'user@host');

            await expect(startContainerOperation).rejects.toThrow('fail');
        });

        it('succeeds when exec returns empty stderr', async () => {
            execMock.mockResolvedValue({ stdout: '', stderr: '' });

            const startContainerOperation = dockerCommands.startContainer('c', 'user@host');

            await expect(startContainerOperation).resolves.toBeUndefined();
            expect(execMock).toHaveBeenCalledWith("docker --host ssh://user@host start c");
        });

        it('throws an error when docker command fails', async () => {
            execMock.mockRejectedValueOnce(new Error('fail'));

            const startContainerOperation = dockerCommands.startContainer('c', 'user@host');

            await expect(startContainerOperation).rejects.toThrow('fail');
        });
    });

    describe('deleteContainer', () => {
        it('throws when stderr present', async () => {
            execMock.mockResolvedValueOnce({ stdout: '', stderr: 'fail' });

            const deleteContainerOperation = dockerCommands.deleteContainer('c', 'ctx');

            await expect(deleteContainerOperation).rejects.toThrow('fail');
        });

        it('succeeds when exec returns empty stderr', async () => {
            execMock.mockResolvedValue({ stdout: '', stderr: '' });

            const deleteContainerOperation = dockerCommands.deleteContainer('c', 'user@host');

            await expect(deleteContainerOperation).resolves.toBeUndefined();
            expect(execMock).toHaveBeenCalledWith("docker --host ssh://user@host rm -f c");
        });

        it('throws an error when docker command fails', async () => {
            execMock.mockRejectedValueOnce(new Error('fail'));

            const deleteContainerOperation = dockerCommands.deleteContainer('c', 'user@host');

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
