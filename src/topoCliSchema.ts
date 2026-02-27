import {
    array,
    boolean,
    Infer,
    nullable,
    optional,
    record,
    string,
    trimmed,
    type,
} from 'superstruct';

export const templateSchema = type({
    id: string(),
    description: string(),
    features: nullable(array(string())),
    url: string(),
    ref: string(),
});

export type TemplateDescription = Infer<typeof templateSchema>;

const healthCheckDependencySchema = type({
    Name: trimmed(string()),
    Healthy: boolean(),
    Value: trimmed(string()),
});

export type HealthCheckDependency = Infer<typeof healthCheckDependencySchema>;

export const healthCheckResultSchema = type({
    Host: type({
        Dependencies: array(healthCheckDependencySchema),
    }),
    Target: type({
        IsLocalhost: boolean(),
        Connectivity: healthCheckDependencySchema,
        SubsystemDriver: healthCheckDependencySchema,
        Dependencies: array(healthCheckDependencySchema),
    }),
});

export type HealthCheckResult = Infer<typeof healthCheckResultSchema>;

const serviceDescriptionSchema = type({
    build: type({
        context: string(),
    }),
    containerName: string(),
    runtime: optional(string()),
    annotations: optional(record(string(), string())),
});

export type ServiceDescription = Infer<typeof serviceDescriptionSchema>;

export const projectDescriptionSchema = type({
    name: string(),
    services: record(string(), serviceDescriptionSchema),
});

export type ProjectDescription = Infer<typeof projectDescriptionSchema>;
