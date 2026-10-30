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
    getAttachShellCommand(
        containerId: string,
        targetSshConnection: string,
    ): string[];
    getLogsCommand(containerId: string, targetSshConnection: string): string[];
    getProjectLogsCommand(
        containerIds: readonly string[],
        targetSshConnection: string,
    ): Promise<string[]>;
}
