import type { PsEntry } from '../services/topoCliSchema';

export interface HostProcessor {
    readonly model: string;
    readonly cores: number;
    readonly features: readonly string[];
}

export interface RemoteProcessor {
    readonly name: string;
}

export interface TargetDescription {
    readonly hostProcessors: readonly HostProcessor[];
    readonly remoteProcessors: readonly RemoteProcessor[];
    readonly totalMemoryKb: number;
}

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
    ? T
    : T extends object
      ? { readonly [P in keyof T]: DeepReadonly<T[P]> }
      : T;

export type ContainerItem = PsEntry & {
    readonly target: string;
};

export type Mutable<T> = { -readonly [P in keyof T]: T[P] };
