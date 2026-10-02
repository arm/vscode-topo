import type {
    HealthCheck,
    HostHealthCheck,
    TargetHealthCheck,
} from '../services/topoCliSchema';

export type Health<T extends HealthCheck = HealthCheck> = {
    readonly capabilities: readonly {
        readonly name: string;
        readonly checks: readonly T[];
    }[];
};

export type HostHealth = Health<HostHealthCheck>;
export type TargetHealth = Health<TargetHealthCheck>;
