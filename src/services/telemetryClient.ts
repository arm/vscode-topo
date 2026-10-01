import { TelemetryReporter } from '@vscode/extension-telemetry';
import { type Disposable, ExtensionMode } from 'vscode';
import { getErrorMessage } from '../util/getErrorMessage';
import { logger } from '../util/logger';

export type TelemetryEventName = 'activate';

export type TelemetryEventProperties = Readonly<
    Record<string, string | number | boolean | undefined>
>;

const EXTENSION_MODE_NAMES: Record<ExtensionMode, string> = {
    [ExtensionMode.Production]: 'production',
    [ExtensionMode.Development]: 'development',
    [ExtensionMode.Test]: 'test',
};

function getDurationSeconds(startedAt: number): number {
    return (Date.now() - startedAt) / 1000;
}

function serializeEventProperties(
    properties: TelemetryEventProperties,
): Record<string, string> {
    const serialized: Record<string, string> = {};
    for (const [name, value] of Object.entries(properties)) {
        if (value !== undefined) {
            serialized[`event.${name}`] = String(value);
        }
    }
    return serialized;
}

export class TelemetryClient implements Disposable {
    private readonly reporter: TelemetryReporter;
    private readonly extensionMode: string;

    constructor(connectionString: string, extensionMode: ExtensionMode) {
        this.extensionMode = EXTENSION_MODE_NAMES[extensionMode];
        this.reporter = new TelemetryReporter(connectionString);
    }

    public async track<T>(
        eventName: TelemetryEventName,
        operation: () => Promise<T>,
        properties: TelemetryEventProperties = {},
    ): Promise<T> {
        const startedAt = Date.now();
        let result: T;
        try {
            result = await operation();
        } catch (error) {
            this.sendError(eventName, error, properties, {
                durationSeconds: getDurationSeconds(startedAt),
            });
            throw error;
        }

        this.send(eventName, properties, {
            durationSeconds: getDurationSeconds(startedAt),
        });

        return result;
    }

    private send(
        eventName: TelemetryEventName,
        properties: TelemetryEventProperties,
        measurements: Record<string, number>,
    ): void {
        try {
            this.reporter.sendTelemetryEvent(
                eventName,
                {
                    ...serializeEventProperties(properties),
                    'meta.extensionMode': this.extensionMode,
                    'meta.outcome': 'success',
                },
                measurements,
            );
        } catch (error) {
            logger.warn(
                `Failed to report telemetry event '${eventName}'`,
                error,
            );
        }
    }

    private sendError(
        eventName: TelemetryEventName,
        error: unknown,
        properties: TelemetryEventProperties,
        measurements: Record<string, number>,
    ): void {
        try {
            this.reporter.sendTelemetryErrorEvent(
                eventName,
                {
                    ...serializeEventProperties(properties),
                    'meta.extensionMode': this.extensionMode,
                    'meta.outcome': 'failure',
                    'meta.errorMessage': getErrorMessage(error),
                    'meta.stack':
                        error instanceof Error ? error.stack : undefined,
                },
                measurements,
            );
        } catch (reportingError) {
            logger.warn(
                `Failed to report telemetry event '${eventName}'`,
                reportingError,
            );
        }
    }

    public async dispose(): Promise<void> {
        await this.reporter.dispose();
    }
}
