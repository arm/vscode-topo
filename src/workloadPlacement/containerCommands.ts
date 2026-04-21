import type {
    DockerInspectItem,
    DockerPsItem,
    DockerStatsItem,
} from '../util/types';

export interface ContainerCommands {
    getCurrentContext(): Promise<string>;
    useContext(contextName: string): Promise<void>;
    getContexts(): Promise<string[]>;
    ensureContext(
        contextName: string,
        targetSshConnection: string,
    ): Promise<void>;
    executeWithContext<T>(
        operation: () => Thenable<T> | T,
        contextName: string,
        timeout: number,
    ): Promise<T>;
    startContainer(
        containerId: string,
        targetSshConnection: string,
    ): Promise<void>;
    stopContainer(
        containerId: string,
        targetSshConnection: string,
    ): Promise<void>;
    deleteContainer(
        containerId: string,
        targetSshConnection: string,
    ): Promise<void>;
    getContainers(targetSshConnection: string): Promise<DockerPsItem[]>;
    inspectContainers(
        containerIds: string[],
        targetSshConnection: string,
    ): Promise<DockerInspectItem[]>;
    containerStats(
        containerIds: string[],
        targetSshConnection: string,
    ): Promise<DockerStatsItem[]>;
    getAttachShellCommand(
        containerId: string,
        targetSshConnection: string,
    ): string;
}
