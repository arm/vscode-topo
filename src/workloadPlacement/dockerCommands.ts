import { exec } from '../util/exec';
import { BOARD_DOCKER_CONTEXT, BOARD_SSH_CONNECTION } from '../manifest';
import { logger } from '../util/logger';
import { ContainerCommands, DockerPsItem } from './containerCommands';

export class DockerCommands implements ContainerCommands {

    public async isContainerRuntimeOn(): Promise<boolean> {
        try {
            const { stdout, stderr } = await exec(`ssh ${BOARD_SSH_CONNECTION} 'docker info'`);
            const err = stderr.trim();
            if (err) {
                throw new Error(err || 'Failed to get Docker info');
            }
            return stdout.includes('Server Version');
        } catch (error: unknown) {
            logger.error('Error checking Docker runtime status:');
            logger.error(error);
            return false;
        }
    }

    public async getCurrentContext(): Promise<string> {
        const { stdout, stderr } = await exec(`docker context show`);
        const err = stderr.trim();
        if (err) {
            throw new Error(err || 'Failed to get current Docker context');
        }
        return stdout.trim();
    }

    public async getContexts(): Promise<string[]> {
        const { stdout, stderr } = await exec(`docker context ls --format '{{.Name}}'`);
        const err = stderr.trim();
        if (err) {
            throw new Error(err || 'Failed to list Docker contexts');
        }
        return stdout.trim().split(/\r?\n/).filter(c => c);
    }

    public async useContext(contextName: string): Promise<void> {
        await exec(`docker context use ${contextName}`);
    }

    /**
     * Ensures the Docker context is set for the board.
     */
    public async ensureContext(contextName = BOARD_DOCKER_CONTEXT): Promise<void> {
        try {
            const { stdout, stderr } = await exec(`docker context ls --format '{{.Name}}'`);
            const err = stderr.trim();
            if (err) {
                throw new Error(err || 'Failed to list Docker contexts');
            }
            const contexts = stdout.trim().split(/\r?\n/).filter(c => c);
            if (contexts.includes(contextName)) {
                return;
            }
            const { stderr: stderr2 } = await exec(`docker context create ${contextName} --docker host=ssh://${BOARD_SSH_CONNECTION}`);
            const err2 = stderr2.trim();
            if (err2) {
                throw new Error(err2 || 'Failed to create Docker context');
            }
        } catch (error: unknown) {
            logger.error('Error ensuring Docker context:');
            logger.error(error);
        }
    }

    public async executeWithContext<T>(
        operation: () => Thenable<T> | T,
        contextName: string,
        timeout: number
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
                await new Promise(resolve => setTimeout(resolve, timeout));
                await this.useContext(currentContext);
            }
        }
    }

    public async getContainers(contextName = BOARD_DOCKER_CONTEXT): Promise<DockerPsItem[]> {
        const { stdout } = await exec(`docker --context ${contextName} ps -a --format "{{json .}}"`);
        const lines = stdout.trim().split(/\r?\n/).filter(l => l);
        if (lines.length === 0) {
            return [];
        }
        const items: DockerPsItem[] = lines.map(l => JSON.parse(l));
        return items;
    }

    public async inspectContainers(containerIds: string[], contextName = BOARD_DOCKER_CONTEXT): Promise<string> {
        const ids = containerIds.join(' ');
        let inspectStdout = '';
        try {
            const result = await exec(
                `docker --context ${contextName} inspect ${ids} --format '{{.Id}};{{json .NetworkSettings.Ports}};{{.HostConfig.Runtime}}'`
            );
            inspectStdout = result.stdout;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            if (typeof err !== 'object' || err === null || !Object.hasOwn(err, 'stderr')) {
                throw err;
            }
            if (err.stderr.trim().split(/\r?\n/).some((l: string) => !l.startsWith('Error: No such object:'))) {
                throw err;
            }
            inspectStdout = err.stdout;
            logger.error(err);
        }
        return inspectStdout.trim();
    }

    public async containerStats(containerIds: string[], contextName = BOARD_DOCKER_CONTEXT): Promise<string> {
        const ids = containerIds.join(' ');
        let statsStdout = '';
        try {
            const result = await exec(
                `docker --context ${contextName} stats ${ids} --no-stream --no-trunc --format '{{.ID}};{{.CPUPerc}};{{.MemUsage}}'`
            );
            statsStdout = result.stdout;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            if (typeof err !== 'object' || err === null || !Object.hasOwn(err, 'stderr')) {
                throw err;
            }
            if (err.stderr.trim().split(/\r?\n/).some((l: string) => !l.startsWith('Error: No such object:'))) {
                throw err;
            }
            statsStdout = err.stdout;
            logger.error(err);
        }
        return statsStdout.trim();
    }

    public async stopContainer(containerId: string, contextName = BOARD_DOCKER_CONTEXT): Promise<void> {
        try {
            const { stderr } = await exec(`docker --context ${contextName} stop ${containerId}`);
            const err = stderr.trim();
            if (err) {
                throw new Error(err || 'Failed to stop service');
            }
        } catch (error: unknown) {
            throw new Error((error as Error).message || 'Failed to stop service');
        }
    }

    public async startContainer(containerId: string, contextName = BOARD_DOCKER_CONTEXT): Promise<void> {
        try {
            const { stderr } = await exec(`docker --context ${contextName} start ${containerId}`);
            const err = stderr.trim();
            if (err) {
                throw new Error(err || 'Failed to start service');
            }
        } catch (error: unknown) {
            throw new Error((error as Error).message || 'Failed to start service');
        }
    }

    public async deleteContainer(containerId: string, contextName = BOARD_DOCKER_CONTEXT): Promise<void> {
        try {
            const { stderr } = await exec(`docker --context ${contextName} rm -f ${containerId}`);
            const err = stderr.trim();
            if (err) {
                throw new Error(err || 'Failed to delete service');
            }
        } catch (error: unknown) {
            throw new Error((error as Error).message || 'Failed to delete service');
        }
    }

    public getAttachShellCommand(containerId: string): string {
        return `docker --context ${BOARD_DOCKER_CONTEXT} exec -it ${containerId} sh`;
    }

}
