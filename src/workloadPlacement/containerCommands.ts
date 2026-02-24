import type { DockerInspectItem, DockerPsItem } from '../util/types';

export interface ContainerCommands {
    getCurrentContext(): Promise<string>;
    useContext(contextName: string): Promise<void>;
    getContexts(): Promise<string[]>;
    ensureContext(
        contextName: string,
        boardSshConnection: string,
    ): Promise<void>;
    executeWithContext<T>(
        operation: () => Thenable<T> | T,
        contextName: string,
        timeout: number,
    ): Promise<T>;
    startContainer(
        containerId: string,
        boardSshConnection: string,
    ): Promise<void>;
    stopContainer(
        containerId: string,
        boardSshConnection: string,
    ): Promise<void>;
    deleteContainer(
        containerId: string,
        boardSshConnection: string,
    ): Promise<void>;
    getContainers(boardSshConnection: string): Promise<DockerPsItem[]>;
    inspectContainers(
        containerIds: string[],
        boardSshConnection: string,
    ): Promise<DockerInspectItem[]>;
    containerStats(
        containerIds: string[],
        boardSshConnection: string,
    ): Promise<string>;
    getAttachShellCommand(
        containerId: string,
        boardSshConnection: string,
    ): string;
}
