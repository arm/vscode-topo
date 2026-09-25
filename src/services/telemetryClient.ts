import type { TelemetryReporter } from '@vscode/extension-telemetry';
import type { Disposable } from 'vscode';
import { getErrorMessage } from '../util/getErrorMessage';
import { logger } from '../util/logger';

function getDurationSeconds(startedAt: number): number {
    return (Date.now() - startedAt) / 1000;
}

export class TelemetryClient implements Disposable {
    constructor(private readonly reporter: TelemetryReporter) {}

    public async track<T>(
        eventName: string,
        operation: () => Promise<T>,
        properties: Record<string, string> = {},
    ): Promise<T> {
        const startedAt = Date.now();
        let result: T;
        try {
            result = await operation();
        } catch (error) {
            this.send('exception', () =>
                this.reporter.sendTelemetryErrorEvent(
                    'exception',
                    {
                        ...properties,
                        failedEvent: eventName,
                        errorMessage: getErrorMessage(error),
                        stack: error instanceof Error ? error.stack : undefined,
                    },
                    { durationSeconds: getDurationSeconds(startedAt) },
                ),
            );
            throw error;
        }

        this.send(eventName, () =>
            this.reporter.sendTelemetryEvent(eventName, properties, {
                durationSeconds: getDurationSeconds(startedAt),
            }),
        );

        return result;
    }

    private send(eventName: string, sendEvent: () => void): void {
        try {
            sendEvent();
        } catch (error) {
            logger.warn(
                `Failed to report telemetry event '${eventName}'`,
                error,
            );
        }
    }

    public async dispose(): Promise<void> {
        await this.reporter.dispose();
    }
}
