import { TopoError } from '../errors/topoError';
import { exec, ExecResult } from '../util/exec';
import { logger } from '../util/logger';
import type { DockerInspectItem, DockerPsItem } from '../util/types';
import type { ContainerCommands } from './containerCommands';
import { getErrorMessage } from '../util/getErrorMessage';

export interface DockerError extends Error {
    stderr: ExecResult['stderr'];
    stdout: ExecResult['stdout'];
}

type DockerInspectOutput = Partial<DockerInspectItem>;

/**
 * Generates a SSH URI based on the board's SSH connection string.
 * @param boardSshConnection - The SSH connection string of the board.
 * @returns The SSH URI.
 */
const getSshUri = (boardSshConnection: string): string => {
    return `ssh://${boardSshConnection}`;
};

/**
 * Checks if a given stderr output indicates an error, ignoring warnings.
 * @param err - The collected error output to check.
 * @returns True if there is an error, false otherwise.
 */
const hasStderrError = (err: string): boolean => {
    const lines = err.split(/\r?\n/).map((line) => line.trim());
    return lines.some(
        (line) => line !== '' && !line.toLowerCase().startsWith('warning:'),
    );
};

/**
 * Checks if the error is a Docker-related error.
 * @param err the error to check
 * @returns true if it's a Docker error, false otherwise
 */
const isDockerError = (err: unknown): err is DockerError => {
    if (!(err instanceof Error)) {
        return false;
    }
    return err.message.startsWith('Command failed: docker ');
};

/**
 * Helper to run docker commands, convert errors to TopoError when appropriate,
 * and log any stderr output as warnings.
 * @param cmd - The docker command to run.
 * @param warnMsg - The message to log if there is any stderr output.
 * @param shouldTreatErrorAsWarning - Optional function to determine if an error should be treated as a warning.
 * @returns The stdout of the command.
 */
const runDockerCmd = async (
    cmd: string,
    warnMsg: string,
    shouldTreatErrorAsWarning?: (err: string) => boolean,
): Promise<string> => {
    let res: ExecResult;
    try {
        res = await exec(cmd);
    } catch (err: unknown) {
        if (isDockerError(err)) {
            const stderr = err.stderr.toString().trim();
            if (shouldTreatErrorAsWarning?.(stderr)) {
                logger.warn(warnMsg, stderr);
                return err.stdout.toString().trim();
            }
            throw new TopoError('DOCKER', stderr, { cause: err });
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
    public async isContainerRuntimeOn(
        boardSshConnection: string,
    ): Promise<boolean> {
        try {
            const { stdout, stderr } = await exec(
                `ssh ${boardSshConnection} 'docker info'`,
            );
            const err = stderr.toString();
            if (hasStderrError(err)) {
                throw new Error(err);
            } else if (err.trim().length > 0) {
                logger.warn(
                    'Warnings emitted when checking Docker runtime status',
                    err,
                );
            }
            return stdout.includes('Server Version');
        } catch (error: unknown) {
            logger.error('Error checking Docker runtime status', error);
            return false;
        }
    }

    public async getCurrentContext(): Promise<string> {
        const cmd = `docker context show`;
        const warnMsg = `Warnings emitted when getting current Docker context`;
        return runDockerCmd(cmd, warnMsg);
    }

    public async getContexts(): Promise<string[]> {
        const cmd = `docker context ls --format '{{.Name}}'`;
        const warnMsg = `Warnings emitted when listing Docker contexts`;
        const stdout = await runDockerCmd(cmd, warnMsg);
        return stdout
            .trim()
            .split(/\r?\n/)
            .filter((c) => c);
    }

    public async useContext(contextName: string): Promise<void> {
        const cmd = `docker context use ${contextName}`;
        await runDockerCmd(
            cmd,
            `Warnings emitted when using Docker context ${contextName}`,
        );
    }

    /**
     * Ensures the Docker context is set for the board.
     */
    public async ensureContext(
        contextName: string,
        boardSshConnection: string,
    ): Promise<void> {
        const cmd1 = `docker context ls --format '{{.Name}}'`;
        const warnMsg1 = `Warnings emitted when listing Docker contexts`;
        const stdout1 = await runDockerCmd(cmd1, warnMsg1);
        const contexts = stdout1.split(/\r?\n/).filter((c) => c);
        if (contexts.includes(contextName)) {
            return;
        }
        const cmd2 = `docker context create ${contextName} --docker host=${getSshUri(boardSshConnection)}`;
        const warnMsg2 = `Warnings emitted when creating Docker context ${contextName}`;
        await runDockerCmd(cmd2, warnMsg2);
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
        boardSshConnection: string,
    ): Promise<DockerPsItem[]> {
        const cmd = `docker --host ${getSshUri(boardSshConnection)} ps -a --format "{{json .}}"`;
        const warnMsg = `Warnings emitted when listing containers`;
        const stdout = await runDockerCmd(cmd, warnMsg);
        const lines = stdout
            .trim()
            .split(/\r?\n/)
            .filter((l) => l);
        if (lines.length === 0) {
            return [];
        }
        const items: DockerPsItem[] = lines.map((l) => JSON.parse(l));
        return items;
    }

    public async inspectContainers(
        containerIds: string[],
        boardSshConnection: string,
    ): Promise<DockerInspectItem[]> {
        if (containerIds.length === 0) {
            return [];
        }
        const ids = containerIds.join(' ');
        const cmd = `docker --host ${getSshUri(boardSshConnection)} inspect ${ids} --format '{{json .}}'`;
        const warnMsg = `Warnings emitted when inspecting containers ${containerIds.join(', ')}`;
        const isErrorAWarning = (err: string): boolean => {
            const lines = err
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter((line) => line !== '');
            return lines.every((line) =>
                line.startsWith('Error: No such object:'),
            );
        };
        const stdout = await runDockerCmd(cmd, warnMsg, isErrorAWarning);
        const lines = stdout
            .trim()
            .split(/\r?\n/)
            .filter((l) => l);
        if (lines.length === 0) {
            return [];
        }
        return lines.reduce((acc: DockerInspectItem[], line) => {
            let parsed: DockerInspectOutput;
            try {
                parsed = JSON.parse(line);
            } catch (err) {
                throw new Error(
                    `Failed to parse Docker inspect JSON output. Error: ${getErrorMessage(err)}`,
                );
            }
            if (!parsed.Id) {
                logger.error(
                    `Docker inspect output is missing Id field, skipping container`,
                );
                return acc;
            }
            const ports = parsed.NetworkSettings?.Ports || {};
            const runtime = parsed.HostConfig?.Runtime || '';
            const annotations = parsed.HostConfig?.Annotations || {};
            const element = {
                Id: parsed.Id,
                NetworkSettings: { Ports: ports },
                HostConfig: {
                    Runtime: runtime,
                    Annotations: annotations,
                },
            };
            acc.push(element);
            return acc;
        }, []);
    }

    public async containerStats(
        containerIds: string[],
        boardSshConnection: string,
    ): Promise<string> {
        if (containerIds.length === 0) {
            return '';
        }
        const ids = containerIds.join(' ');
        const cmd = `docker --host ${getSshUri(boardSshConnection)} stats ${ids} --no-stream --no-trunc --format '{{.ID}};{{.CPUPerc}};{{.MemUsage}}'`;
        const warnMsg = `Warnings emitted when getting container stats for container ${containerIds.join(', ')}`;
        const isErrorAWarning = (err: string): boolean => {
            const lines = err
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter((line) => line !== '');
            return lines.every((line) =>
                line.startsWith('Error: No such object:'),
            );
        };
        return runDockerCmd(cmd, warnMsg, isErrorAWarning);
    }

    public async stopContainer(
        containerId: string,
        boardSshConnection: string,
    ): Promise<void> {
        const cmd = `docker --host ${getSshUri(boardSshConnection)} stop ${containerId}`;
        const warnMsg = `Warnings emitted when stopping container ${containerId}`;
        await runDockerCmd(cmd, warnMsg);
    }

    public async startContainer(
        containerId: string,
        boardSshConnection: string,
    ): Promise<void> {
        const cmd = `docker --host ${getSshUri(boardSshConnection)} start ${containerId}`;
        const warnMsg = `Warnings emitted when starting container ${containerId}`;
        await runDockerCmd(cmd, warnMsg);
    }

    public async deleteContainer(
        containerId: string,
        boardSshConnection: string,
    ): Promise<void> {
        const cmd = `docker --host ${getSshUri(boardSshConnection)} rm -f ${containerId}`;
        const warnMsg = `Warnings emitted when deleting container ${containerId}`;
        await runDockerCmd(cmd, warnMsg);
    }

    public getAttachShellCommand(
        containerId: string,
        boardSshConnection: string,
    ): string {
        return `docker --host ${getSshUri(boardSshConnection)} exec -it ${containerId} sh`;
    }
}
