import {
    ServiceDescription,
    TargetHealthCheckResult,
} from '../topoCliSchema';

export interface HostProcessor {
    model: string;
    cores: number;
    features: string[];
}

export interface RemoteProcessor {
    name: string;
}

export interface TargetDescription {
    hostProcessors: HostProcessor[];
    remoteProcessors: RemoteProcessor[];
}

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

/**
 * Represents the port mapping information from Docker's `NetworkSettings.Ports`.
 *
 * The keys use the format `"<port>/<protocol>"`, for example `"80/tcp"` or `"443/udp"`,
 * describing the container port and protocol. Each key maps to an array of port
 * bindings, where each binding describes how that container port is published on
 * the host.
 *
 * - `HostIp` is the IP address on the host where the port is exposed (e.g. `"0.0.0.0"` or `"127.0.0.1"`).
 * - `HostPort` is the port number on the host as a string (e.g. `"8080"`).
 */
export type DockerPorts = Record<
    string,
    Array<{ HostIp: string; HostPort: string }>
>;

export interface DockerInspectItem {
    Id: string;
    NetworkSettings: {
        Ports: DockerPorts;
    };
    HostConfig: {
        Runtime: string;
        Annotations: Record<string, string>;
    };
}

/**
 * Represents a Docker container item.
 *
 * @property {string} id - The unique identifier for the container.
 * @property {string} name - The name assigned to the container.
 * @property {string} image - The Docker image used to create the container.
 * @property {string} state - The current state of the container (e.g., "running", "stopped").
 * @property {string} status - A descriptive status string of the container.
 * @property {string} labels - A string of key-value labels associated with the container.
 * @property {string} runningFor - A description indicating how long the container has been running.
 * @property {string} createdAt - The timestamp indicating when the container was created.
 * @property {string} runtime - The runtime of the container.
 * @property {DockerPorts} ports - The ports exposed by the container.
 * @property {string} target - The target associated with the container.
 */
export interface ContainerItem {
    id: string;
    name: string;
    image: string;
    state: string;
    status: string;
    labels: string;
    runningFor: string;
    createdAt: string;
    runtime: string;
    annotations: Record<string, string>;
    ports: DockerPorts;
    target: string;
}

export interface ServiceCreationDescription extends ServiceDescription {
    name: string;
}

export type MessagePoster = {
    postMessage(message: unknown): void | Thenable<boolean>;
};

export type Mutable<T> = { -readonly [P in keyof T]: T[P] };

export type TargetStatus = 'disconnected' | 'connected' | 'error';

export interface TargetState {
    health: TargetHealthCheckResult | undefined;
    status: TargetStatus;
}

export type Loadable<T> =
    | { status: 'loading'; placeholder: Loadable<T> }
    | { status: 'loaded'; data: T }
    | { status: 'error'; error: Error };
