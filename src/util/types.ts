import { PsEntry, ServiceDescription } from '../services/topoCliSchema';

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
    totalMemoryKb: number;
}

export interface ContainerItem extends PsEntry {
    target: string;
}

export interface ServiceCreationDescription extends ServiceDescription {
    name: string;
}

export type MessagePoster = {
    postMessage(message: unknown): void | Thenable<boolean>;
};

export type Mutable<T> = { -readonly [P in keyof T]: T[P] };
