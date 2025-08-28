/**
 * Represents a Docker container item from the output of the "docker ps" command.
 *
 * @property {string} ID - The unique identifier for the container.
 * @property {string} Names - The names assigned to the container.
 * @property {string} Image - The Docker image used to create the container.
 * @property {string} State - The current state of the container (e.g., "running", "stopped").
 * @property {string} Status - A descriptive status string of the container.
 * @property {string} Labels - A string of key-value labels associated with the container.
 * @property {string} RunningFor - A description indicating how long the container has been running.
 * @property {string} CreatedAt - The timestamp indicating when the container was created.
 */
export interface DockerPsItem {
  ID: string;
  Names: string;
  Image: string;
  State: string;
  Status: string;
  Labels: string;
  RunningFor: string;
  CreatedAt: string;
}

export interface ContainerCommands {
    isContainerRuntimeOn(): Promise<boolean>;
    getCurrentContext(): Promise<string>;
    useContext(contextName: string): Promise<void>;
    ensureContext(): Promise<void>;
    executeWithContext<T>(
        operation: () => Thenable<T> | T,
        contextName: string,
        timeout: number
    ): Promise<T>;
    startContainer(containerId: string): Promise<void>;
    stopContainer(containerId: string): Promise<void>;
    deleteContainer(containerId: string): Promise<void>;
    getContainers(): Promise<DockerPsItem[]>;
    inspectContainers(containerIds: string[]): Promise<string>;
    getAttachShellCommand(containerId: string): string;
}
