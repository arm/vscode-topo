import { TelemetryReporter } from '@vscode/extension-telemetry';
import type { Disposable } from 'vscode';
import { getErrorMessage } from '../util/getErrorMessage';
import { logger } from '../util/logger';

export type TelemetryEventName = 'activate';

function getDurationSeconds(startedAt: number): number {
    return (Date.now() - startedAt) / 1000;
}

export class TelemetryClient implements Disposable {
    private readonly reporter: TelemetryReporter;

    constructor(connectionString: string) {
        this.reporter = new TelemetryReporter(connectionString);
    }

    public async track<T>(
        eventName: TelemetryEventName,
        operation: () => Promise<T>,
        properties: Record<string, string> = {},
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
        properties: Record<string, string>,
        measurements: Record<string, number>,
    ): void {
        try {
            this.reporter.sendTelemetryEvent(
                eventName,
                { ...properties, outcome: 'success' },
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
        properties: Record<string, string>,
        measurements: Record<string, number>,
    ): void {
        try {
            this.reporter.sendTelemetryErrorEvent(
                eventName,
                {
                    ...properties,
                    outcome: 'failure',
                    errorMessage: getErrorMessage(error),
                    stack: error instanceof Error ? error.stack : undefined,
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
