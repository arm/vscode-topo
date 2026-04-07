import {
    array,
    boolean,
    enums,
    Infer,
    nullable,
    optional,
    record,
    string,
    trimmed,
    type,
} from 'superstruct';

export const templateSchema = type({
    name: string(),
    description: string(),
    features: nullable(array(string())),
    url: string(),
    ref: string(),
});

export type TemplateDescription = Infer<typeof templateSchema>;

const healthCheckStatusSchema = enums(['ok', 'warning', 'error', 'info']);

export type HealthCheckStatus = Infer<typeof healthCheckStatusSchema>;

export const healthCheckDependencySchema = type({
    name: trimmed(string()),
    status: healthCheckStatusSchema,
    value: trimmed(string()),
    fix: optional(trimmed(string())),
});

export type HealthCheckDependency = Infer<typeof healthCheckDependencySchema>;

export const healthCheckResultSchema = type({
    host: type({
        dependencies: array(healthCheckDependencySchema),
    }),
    target: type({
        isLocalhost: boolean(),
        connectivity: healthCheckDependencySchema,
        subsystemDriver: healthCheckDependencySchema,
        dependencies: array(healthCheckDependencySchema),
    }),
});

export type HealthCheckResult = Infer<typeof healthCheckResultSchema>;

const serviceDescriptionSchema = type({
    build: optional(
        type({
            context: string(),
        }),
    ),
    containerName: optional(string()),
    runtime: optional(string()),
    annotations: optional(record(string(), string())),
});

export type ServiceDescription = Infer<typeof serviceDescriptionSchema>;

export const projectDescriptionSchema = type({
    name: string(),
    services: record(string(), serviceDescriptionSchema),
});

export type ProjectDescription = Infer<typeof projectDescriptionSchema>;
