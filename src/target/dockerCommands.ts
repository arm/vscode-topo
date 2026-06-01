import { WrappedError, WrappedErrorLog } from '../errors/wrappedError';
import { execFile, ExecFileResult } from '../util/exec';
import { logger } from '../util/logger';
import type { DockerInspectItem, DockerPsItem } from '../util/types';
import type { ContainerCommands } from './containerCommands';
import { getErrorMessage } from '../util/getErrorMessage';

export interface DockerError extends Error {
    stderr: ExecFileResult['stderr'];
    stdout: ExecFileResult['stdout'];
}

type DockerInspectOutput = Partial<DockerInspectItem>;

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
    public async getCurrentContext(): Promise<string> {
        const warnMsg = `Warnings emitted when getting current Docker context`;
        return runDockerCmd(['context', 'show'], warnMsg);
    }

    public async getContexts(): Promise<string[]> {
        const warnMsg = `Warnings emitted when listing Docker contexts`;
        const stdout = await runDockerCmd(
            ['context', 'ls', '--format', '{{.Name}}'],
            warnMsg,
        );
        return splitLines(stdout);
    }

    public async useContext(contextName: string): Promise<void> {
        await runDockerCmd(
            ['context', 'use', contextName],
            `Warnings emitted when using Docker context ${contextName}`,
        );
    }

    public async ensureContext(
        contextName: string,
        targetSshConnection: string,
    ): Promise<void> {
        const warnMsg1 = `Warnings emitted when listing Docker contexts`;
        const stdout = await runDockerCmd(
            ['context', 'ls', '--format', '{{.Name}}'],
            warnMsg1,
        );
        const contexts = splitLines(stdout);
        if (contexts.includes(contextName)) {
            return;
        }
        const warnMsg2 = `Warnings emitted when creating Docker context ${contextName}`;
        await runDockerCmd(
            [
                'context',
                'create',
                contextName,
                '--docker',
                `host=${getSshUri(targetSshConnection)}`,
            ],
            warnMsg2,
        );
    }

    public async executeWithContext<T>(
        operation: () => Thenable<T> | T,
        contextName: string,
        timeout: number,
    ): Promise<T> {
        let currentContext: string | undefined;
        try {
            currentContext = await this.getCurrentContext();
            await this.useContext(contextName);
            return await operation();
        } finally {
            if (currentContext !== undefined) {
                // Awaiting for the callback does not work,
                // so we need to wait a bit before switching back to the original context
                // to ensure the callback has time to complete.
                await new Promise((resolve) => setTimeout(resolve, timeout));
                await this.useContext(currentContext);
            }
        }
    }

    public async getContainers(
        targetSshConnection: string,
    ): Promise<DockerPsItem[]> {
        const warnMsg = `Warnings emitted when listing containers`;
        const stdout = await runDockerCmd(
            [
                '--host',
                getSshUri(targetSshConnection),
                'ps',
                '-a',
                '--format',
                '{{json .}}',
            ],
            warnMsg,
        );
        const lines = splitLines(stdout);
        return lines.map((l) => JSON.parse(l));
    }

    public async inspectContainers(
        containerIds: string[],
        targetSshConnection: string,
    ): Promise<DockerInspectItem[]> {
        if (containerIds.length === 0) {
            return [];
        }
        const warnMsg = `Warnings emitted when inspecting containers ${containerIds.join(', ')}`;
        const isErrorAWarning = (err: string): boolean => {
            const lines = splitLines(err);
            return lines.every((l) => l.startsWith('Error: No such object:'));
        };
        const stdout = await runDockerCmd(
            [
                '--host',
                getSshUri(targetSshConnection),
                'inspect',
                ...containerIds,
                '--format',
                '{{json .}}',
            ],
            warnMsg,
            isErrorAWarning,
        );
        const lines = splitLines(stdout);

        const inspectItems: DockerInspectItem[] = [];
        for (const line of lines) {
            let parsed: DockerInspectOutput;
            try {
                parsed = JSON.parse(line);
            } catch (err) {
                throw new Error(
                    `Failed to parse Docker inspect JSON output. Error: ${getErrorMessage(err)}`,
                    { cause: err },
                );
            }
            if (!parsed.Id) {
                logger.error(
                    `Docker inspect output is missing Id field, skipping container`,
                );
                continue;
            }
            const ports = parsed.NetworkSettings?.Ports || {};
            const runtime = parsed.HostConfig?.Runtime || '';
            const annotations = parsed.HostConfig?.Annotations || {};
            inspectItems.push({
                Id: parsed.Id,
                NetworkSettings: { Ports: ports },
                HostConfig: {
                    Runtime: runtime,
                    Annotations: annotations,
                },
            });
        }
        return inspectItems;
    }

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
    ): string {
        return `docker --host ${getSshUri(targetSshConnection)} exec -it ${containerId} sh`;
    }
}
