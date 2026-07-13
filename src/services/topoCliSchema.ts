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

const projectCompatibilitySchema = enums(['supported', 'unsupported']);

export const projectSchema = type({
    name: string(),
    description: string(),
    features: nullable(array(string())),
    url: string(),
    ref: string(),
    compatibility: optional(projectCompatibilitySchema),
});

export type ProjectDescription = Infer<typeof projectSchema>;

const healthCheckStatusSchema = enums(['ok', 'warning', 'error', 'info']);

export type HealthCheckStatus = Infer<typeof healthCheckStatusSchema>;

export const healthCheckFixSchema = type({
    description: trimmed(string()),
    command: optional(trimmed(string())),
});

export type HealthCheckFix = Infer<typeof healthCheckFixSchema>;

export const healthCheckSchema = type({
    name: trimmed(string()),
    status: healthCheckStatusSchema,
    value: trimmed(string()),
    fix: optional(healthCheckFixSchema),
});

export type HealthCheck = Infer<typeof healthCheckSchema>;

const targetHealthReportSchema = type({
    destination: trimmed(string()),
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

const containerStateSchema = enums([
    'created',
    'restarting',
    'running',
    'removing',
    'paused',
    'exited',
    'dead',
]);

export type ContainerState = Infer<typeof containerStateSchema>;

const psEntrySchema = type({
    id: string(),
    names: string(),
    image: string(),
    status: string(),
    state: containerStateSchema,
    processingDomain: string(),
    address: string(),
});

export type PsEntry = Infer<typeof psEntrySchema>;

export const psSchema = type({
    containers: array(psEntrySchema),
});

export type PsOutput = Infer<typeof psSchema>;
