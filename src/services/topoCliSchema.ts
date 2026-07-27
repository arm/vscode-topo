import {
    array,
    boolean,
    enums,
    Infer,
    number,
    nullable,
    optional,
    string,
    trimmed,
    type,
    defaulted,
} from 'superstruct';

const trimmedStringSchema = trimmed(string());

const projectCompatibilitySchema = trimmed(enums(['supported', 'unsupported']));

export const projectSchema = type({
    name: trimmedStringSchema,
    description: trimmedStringSchema,
    features: nullable(array(trimmedStringSchema)),
    url: trimmedStringSchema,
    ref: trimmedStringSchema,
    compatibility: optional(projectCompatibilitySchema),
});

export type ProjectDescription = Infer<typeof projectSchema>;

const healthCheckStatusSchema = trimmed(
    enums(['ok', 'warning', 'error', 'info']),
);

export type HealthCheckStatus = Infer<typeof healthCheckStatusSchema>;

export const healthCheckFixSchema = type({
    description: trimmedStringSchema,
    command: optional(trimmedStringSchema),
});

export type HealthCheckFix = Infer<typeof healthCheckFixSchema>;

export const healthCheckSchema = type({
    name: trimmedStringSchema,
    status: healthCheckStatusSchema,
    value: trimmedStringSchema,
    fix: optional(healthCheckFixSchema),
});

export type HealthCheck = Infer<typeof healthCheckSchema>;

const targetHealthReportSchema = type({
    destination: trimmedStringSchema,
    isLocalhost: boolean(),
    connectivity: healthCheckSchema,
    processingDomainDriver: healthCheckSchema,
    dependencies: array(healthCheckSchema),
});

const hostHealthSchema = type({
    dependencies: array(healthCheckSchema),
});

export const hostHealthReportSchema = type({
    host: hostHealthSchema,
});

export type HostHealthReport = Infer<typeof hostHealthReportSchema>;

export type TargetHealthReport = Infer<typeof targetHealthReportSchema>;

export const healthReportSchema = type({
    host: hostHealthSchema,
    target: targetHealthReportSchema,
});

export type HealthReport = Infer<typeof healthReportSchema>;

const describeHostProcessorSchema = type({
    model: trimmedStringSchema,
    cores: number(),
    features: array(trimmedStringSchema),
});

const describeRemoteprocSchema = type({
    name: trimmedStringSchema,
});

export const targetDescriptionSchema = type({
    hostProcessors: array(describeHostProcessorSchema),
    remoteProcessors: defaulted(array(describeRemoteprocSchema), []),
    totalMemoryKb: number(),
});

const topoLogLevelSchema = trimmed(enums(['DEBUG', 'INFO', 'WARN', 'ERROR']));

export const topoLogEntrySchema = type({
    time: trimmedStringSchema,
    level: topoLogLevelSchema,
    msg: trimmedStringSchema,
});

const containerStateSchema = trimmed(
    enums([
        'created',
        'restarting',
        'running',
        'removing',
        'paused',
        'exited',
        'dead',
    ]),
);

export type ContainerState = Infer<typeof containerStateSchema>;

const psEntrySchema = type({
    id: trimmedStringSchema,
    names: trimmedStringSchema,
    image: trimmedStringSchema,
    status: trimmedStringSchema,
    state: containerStateSchema,
    processingDomain: trimmedStringSchema,
    address: trimmedStringSchema,
});

export type PsEntry = Infer<typeof psEntrySchema>;

export const psSchema = type({
    containers: array(psEntrySchema),
});

export type PsOutput = Infer<typeof psSchema>;
