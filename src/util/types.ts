import type { PsEntry } from '../services/topoCliSchema';

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
    ? T
    : T extends object
      ? { readonly [P in keyof T]: DeepReadonly<T[P]> }
      : T;

export type ContainerItem = PsEntry & {
    readonly target: string;
};

export type Mutable<T> = { -readonly [P in keyof T]: T[P] };
