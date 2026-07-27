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

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
    ? T
    : T extends ReadonlyMap<infer K, infer V>
      ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
      : T extends ReadonlySet<infer V>
        ? ReadonlySet<DeepReadonly<V>>
        : T extends object
          ? { readonly [P in keyof T]: DeepReadonly<T[P]> }
          : T;

export type Mutable<T> = { -readonly [P in keyof T]: T[P] };
