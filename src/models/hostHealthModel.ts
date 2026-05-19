import * as vscode from 'vscode';
import { HostHealthCheckResult } from '../topoCliSchema';

const defaultHealthCheckResult: HostHealthCheckResult = {
    host: {
        dependencies: [],
    },
};

export class HostHealthModel {
    private _onChanged: vscode.EventEmitter<void> =
        new vscode.EventEmitter<void>();
    public readonly onChanged: vscode.Event<void> = this._onChanged.event;

    private _health?: Promise<HostHealthCheckResult>;

    public set health(healthPromise: Promise<HostHealthCheckResult>) {
        this._health = healthPromise;
        this._onChanged.fire();
    }

    public get health(): Promise<HostHealthCheckResult> {
        return this._health ?? Promise.resolve(defaultHealthCheckResult);
    }
}
