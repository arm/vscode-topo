import * as vscode from 'vscode';
import { HostHealthCheck } from '../topoCliSchema';
import { Loadable, unloaded } from '../util/loadable';

const defaultHealthCheckResult: Loadable<HostHealthCheck> = unloaded();

export class HostModel {
    private _onHealthChanged: vscode.EventEmitter<void> =
        new vscode.EventEmitter<void>();
    public readonly onHealthChanged: vscode.Event<void> =
        this._onHealthChanged.event;

    private _health: Loadable<HostHealthCheck> = defaultHealthCheckResult;

    public setHealth(health: Loadable<HostHealthCheck>): void {
        this._health = health;
        this._onHealthChanged.fire();
    }

    public get health(): Loadable<HostHealthCheck> {
        return this._health;
    }
}
