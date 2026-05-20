import * as vscode from 'vscode';
import { HostHealthCheckResult } from '../topoCliSchema';

const defaultHealthCheckResult: HostHealthCheckResult = {
    host: {
        dependencies: [],
    },
};

export class HostModel {
    private _onHealthChanged: vscode.EventEmitter<void> =
        new vscode.EventEmitter<void>();
    public readonly onHealthChanged: vscode.Event<void> =
        this._onHealthChanged.event;

    private _health?: Promise<HostHealthCheckResult>;

    public set health(healthPromise: Promise<HostHealthCheckResult>) {
        this._health = healthPromise;
        this._onHealthChanged.fire();
    }

    public get health(): Promise<HostHealthCheckResult> {
        return this._health ?? Promise.resolve(defaultHealthCheckResult);
    }
}
