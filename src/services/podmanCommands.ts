import { WrappedError } from '../errors/wrappedError';
import { assertValidSshDestination } from '../util/assertValidSshDestination';
import { execFile } from '../util/exec';
import { getErrorMessage } from '../util/getErrorMessage';
import { logger } from '../util/logger';
import type { ContainerCommands } from './containerCommands';

function quoteRemoteArgument(argument: string): string {
    return `'${argument.replaceAll("'", "'\\''")}'`;
}

function getCommand(
    target: string,
    args: string[],
    interactive = false,
): string[] {
    assertValidSshDestination(target);
    // Match Topo's plain-localhost handling; a user or port requires SSH.
    if (target.toLowerCase() === 'localhost' || target === '127.0.0.1') {
        return ['podman', ...args];
    }

    // Match Topo's login-shell environment and quote both shell command layers.
    const command = ['podman', ...args].map(quoteRemoteArgument).join(' ');
    return [
        'ssh',
        ...(interactive ? ['-t'] : ['-T', '-o', 'BatchMode=yes']),
        '--',
        `ssh://${target}`,
        `/bin/sh -c 'exec "\${SHELL:-/bin/sh}" -l -c "$1"' sh ${quoteRemoteArgument(command)}`,
    ];
}

async function runCommand(
    target: string,
    args: string[],
    warnMessage: string,
): Promise<void> {
    const [executable, ...commandArgs] = getCommand(target, args);
    try {
        const { stderr } = await execFile(executable, commandArgs);
        const warning = stderr.toString().trim();
        if (warning) {
            logger.warn(warnMessage, warning);
        }
    } catch (error) {
        const stderr =
            error instanceof Error && 'stderr' in error
                ? String(error.stderr ?? '').trim()
                : '';
        const message = stderr || getErrorMessage(error);
        throw new WrappedError(
            'PODMAN',
            message,
            [{ level: 'ERROR', msg: message }],
            { cause: error },
        );
    }
}

export class PodmanCommands implements ContainerCommands {
    public async startContainer(
        containerId: string,
        targetSshConnection: string,
    ): Promise<void> {
        await runCommand(
            targetSshConnection,
            ['start', '--', containerId],
            `Warnings emitted when starting container ${containerId}`,
        );
    }

    public async stopContainer(
        containerId: string,
        targetSshConnection: string,
    ): Promise<void> {
        await runCommand(
            targetSshConnection,
            ['stop', '--', containerId],
            `Warnings emitted when stopping container ${containerId}`,
        );
    }

    public async deleteContainer(
        containerId: string,
        targetSshConnection: string,
    ): Promise<void> {
        await runCommand(
            targetSshConnection,
            ['rm', '-f', '--', containerId],
            `Warnings emitted when deleting container ${containerId}`,
        );
    }

    public getAttachShellCommand(
        containerId: string,
        targetSshConnection: string,
    ): string[] {
        return getCommand(
            targetSshConnection,
            ['exec', '-it', '--', containerId, 'sh'],
            true,
        );
    }
}
