import { PsEntry } from '../services/topoCliSchema';

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
