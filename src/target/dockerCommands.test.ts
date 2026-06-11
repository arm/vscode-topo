import { DockerCommands } from './dockerCommands';
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

type DockerCommandError = Error & { stdout: string; stderr: string };

function makeDockerError(stdout: string, stderr: string): DockerCommandError {
    const e = new Error(
        'Command failed: docker something',
    ) as DockerCommandError;
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

        it('throws a WrappedError with Docker stderr logs when exec rejects with a DockerError', async () => {
            const dockerErr = makeDockerError(
                '',
                'Error: container not found\n\nWarning: low disk space\nsome other message',
            );
            execFileMock.mockRejectedValueOnce(dockerErr);

            const operation = dockerCommands.inspectContainers(['a'], 'ctx');

            await expect(operation).rejects.toThrow(WrappedError);
            await expect(operation).rejects.toMatchObject({
                code: 'DOCKER',
                message:
                    'Error: container not found\n\nWarning: low disk space\nsome other message',
                logs: [
                    {
                        level: 'Error',
                        msg: 'Error: container not found',
                    },
                    {
                        level: 'Warning',
                        msg: 'Warning: low disk space',
                    },
                    {
                        level: 'Error',
                        msg: 'some other message',
                    },
                ],
            });
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
            expect(cmd).toEqual([
                'docker',
                '--host',
                'ssh://ctx',
                'exec',
                '-it',
                'abc',
                'sh',
            ]);
        });
    });
});
