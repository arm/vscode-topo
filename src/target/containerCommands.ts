import type { DockerInspectItem, DockerPsItem } from '../util/types';

export interface ContainerCommands {
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
    getAttachShellCommand(
        containerId: string,
        targetSshConnection: string,
    ): string[];
}
