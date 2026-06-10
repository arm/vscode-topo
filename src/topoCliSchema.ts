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
    defaulted,
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

export const healthCheckFixSchema = type({
    description: trimmed(string()),
    command: optional(trimmed(string())),
});

export type HealthCheckFix = Infer<typeof healthCheckFixSchema>;

export const IssueCheckSchema = type({
    name: trimmed(string()),
    status: healthCheckStatusSchema,
    value: trimmed(string()),
    fix: optional(healthCheckFixSchema),
});

export type IssueCheck = Infer<typeof IssueCheckSchema>;

const targetHealthCheckSchema = type({
    destination: trimmed(string()),
    isLocalhost: boolean(),
    connectivity: IssueCheckSchema,
    subsystemDriver: IssueCheckSchema,
    dependencies: array(IssueCheckSchema),
});

const hostHealthSchema = type({
    dependencies: array(IssueCheckSchema),
});

export const hostHealthCheckSchema = type({
    host: hostHealthSchema,
});

export type HostHealthCheck = Infer<typeof hostHealthCheckSchema>;

export type TargetHealthCheck = Infer<typeof targetHealthCheckSchema>;

export const healthCheckSchema = type({
    host: hostHealthSchema,
    target: targetHealthCheckSchema,
});

export type HealthCheck = Infer<typeof healthCheckSchema>;

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
    remoteProcessors: defaulted(array(describeRemoteprocSchema), []),
    totalMemoryKb: number(),
});

const topoLogLevelSchema = enums(['DEBUG', 'INFO', 'WARN', 'ERROR']);

export const topoLogEntrySchema = type({
    time: string(),
    level: topoLogLevelSchema,
    msg: string(),
});
