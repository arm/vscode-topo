import type { Result } from '../util/result';

export interface ContainerCommands {
    startContainer(
        containerId: string,
        targetSshConnection: string,
    ): Promise<Result<void>>;
    stopContainer(
        containerId: string,
        targetSshConnection: string,
    ): Promise<Result<void>>;
    deleteContainer(
        containerId: string,
        targetSshConnection: string,
    ): Promise<Result<void>>;
    getAttachShellCommand(
        containerId: string,
        targetSshConnection: string,
    ): string[];
}
