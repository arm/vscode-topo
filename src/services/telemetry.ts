import type { Disposable } from 'vscode';
import type { TelemetryClient } from './telemetryClient';

export class Telemetry implements Disposable {
    constructor(private readonly client?: TelemetryClient) {}

    public trackActivation<T>(activate: () => Promise<T>): Promise<T> {
        return this.client?.track('activate', activate) ?? activate();
    }

    public async dispose(): Promise<void> {
        await this.client?.dispose();
    }
}
