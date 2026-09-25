import { TelemetryReporter } from '@vscode/extension-telemetry';
import type { Disposable } from 'vscode';
import { TelemetryClient } from './telemetryClient';
import { logger } from '../util/logger';

export class Telemetry implements Disposable {
    private readonly client?: TelemetryClient;

    constructor() {
        const connectionString = __TELEMETRY_CONNECTION_STRING__;
        if (!connectionString) {
            logger.info(
                'Telemetry disabled: AZURE_ANALYTICS_CONNECTION_STRING is not configured',
            );
            return;
        }

        try {
            this.client = new TelemetryClient(
                new TelemetryReporter(connectionString),
            );
        } catch (error) {
            logger.warn('Failed to initialize telemetry', error);
        }
    }

    public trackActivation<T>(activate: () => Promise<T>): Promise<T> {
        return this.client?.track('activate', activate) ?? activate();
    }

    public async dispose(): Promise<void> {
        await this.client?.dispose();
    }
}
