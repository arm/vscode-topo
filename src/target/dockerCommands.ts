import { WrappedError, WrappedErrorLog } from '../errors/wrappedError';
import { execFile, ExecFileResult } from '../util/exec';
import { logger } from '../util/logger';
import type { ContainerCommands } from './containerCommands';

export interface DockerError extends Error {
    stderr: ExecFileResult['stderr'];
    stdout: ExecFileResult['stdout'];
}

const splitLines = (stdout: string): string[] => {
    return stdout.split(/\r?\n/).filter((l) => l);
};

const getSshUri = (targetSshConnection: string): string => {
    return `ssh://${targetSshConnection}`;
};

const isDockerError = (err: unknown): err is DockerError => {
    if (!(err instanceof Error)) {
        return false;
    }
    return err.message.startsWith('Command failed: docker ');
};

/**
 * Helper to run docker commands, convert errors to WrappedError when appropriate,
 * and log any stderr output as warnings.
 * @param args - The docker command arguments to run.
 * @param warnMsg - The message to log if there is any stderr output.
 * @param shouldTreatErrorAsWarning - Optional function to determine if an error should be treated as a warning.
 * @returns The stdout of the command.
 */
export const parseDockerStderr = (stderr: string): WrappedErrorLog[] => {
    return splitLines(stderr).map((line): WrappedErrorLog => {
        const trimmed = line.trim();
        if (trimmed.startsWith('Warning:')) {
            return { level: 'Warning', msg: trimmed };
        }
        return { level: 'Error', msg: trimmed };
    });
};

const runDockerCmd = async (
    args: string[],
    warnMsg: string,
    shouldTreatErrorAsWarning?: (err: string) => boolean,
): Promise<string> => {
    let res: ExecFileResult;
    try {
        res = await execFile('docker', args);
    } catch (err: unknown) {
        if (isDockerError(err)) {
            const stderr = err.stderr.toString().trim();
            if (shouldTreatErrorAsWarning?.(stderr)) {
                logger.warn(warnMsg, stderr);
                return err.stdout.toString().trim();
            }
            const logs = parseDockerStderr(stderr);
            throw new WrappedError('DOCKER', stderr, logs, { cause: err });
        } else {
            throw err;
        }
    }
    const stderr = res.stderr.toString().trim();
    if (stderr) {
        logger.warn(warnMsg, stderr);
    }
    const stdout = res.stdout.toString().trim();
    return stdout;
};

export class DockerCommands implements ContainerCommands {
    public async stopContainer(
        containerId: string,
        targetSshConnection: string,
    ): Promise<void> {
        const warnMsg = `Warnings emitted when stopping container ${containerId}`;
        await runDockerCmd(
            ['--host', getSshUri(targetSshConnection), 'stop', containerId],
            warnMsg,
        );
    }

    public async startContainer(
        containerId: string,
        targetSshConnection: string,
    ): Promise<void> {
        const warnMsg = `Warnings emitted when starting container ${containerId}`;
        await runDockerCmd(
            ['--host', getSshUri(targetSshConnection), 'start', containerId],
            warnMsg,
        );
    }

    public async deleteContainer(
        containerId: string,
        targetSshConnection: string,
    ): Promise<void> {
        const warnMsg = `Warnings emitted when deleting container ${containerId}`;
        await runDockerCmd(
            ['--host', getSshUri(targetSshConnection), 'rm', '-f', containerId],
            warnMsg,
        );
    }

    public getAttachShellCommand(
        containerId: string,
        targetSshConnection: string,
    ): string[] {
        return [
            'docker',
            '--host',
            getSshUri(targetSshConnection),
            'exec',
            '-it',
            containerId,
            'sh',
        ];
    }
}
