import {
    array,
    boolean,
    enums,
    Infer,
    number,
    nullable,
    optional,
    record,
    string,
    trimmed,
    type,
} from 'superstruct';

const templateCompatibilitySchema = enums(['supported', 'unsupported']);

export const templateSchema = type({
    name: string(),
    description: string(),
    features: nullable(array(string())),
    url: string(),
    ref: string(),
    compatibility: optional(templateCompatibilitySchema),
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

const describeHostProcessorSchema = type({
    model: trimmed(string()),
    cores: number(),
    features: array(trimmed(string())),
});

const describeRemoteprocSchema = type({
    name: trimmed(string()),
});

export const targetDescriptionSchema = type({
    hostProcessors: array(describeHostProcessorSchema),
    remoteProcessors: array(describeRemoteprocSchema),
});

const topoLogLevelSchema = enums(['DEBUG', 'INFO', 'WARN', 'ERROR']);

export const topoLogEntrySchema = type({
    time: string(),
    level: topoLogLevelSchema,
    msg: string(),
});
