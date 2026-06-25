import { DockerCommands, parseDockerStderr } from './dockerCommands';
import { execFile } from '../util/exec';
import { logger } from '../util/logger';
import type { Mock } from 'vitest';

vi.mock('../util/exec', () => ({
    execFile: vi.fn(),
}));

vi.mock('../util/logger');

const execFileMock: Mock = vi.mocked(execFile);

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
