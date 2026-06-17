import * as vscode from 'vscode';
import { HostHealthCheck } from '../topoCliSchema';
import { Loadable, unloaded } from '../util/loadable';

export class HostModel {
    private _onHealthChanged: vscode.EventEmitter<void> =
        new vscode.EventEmitter<void>();
    public readonly onHealthChanged: vscode.Event<void> =
        this._onHealthChanged.event;

    private _health: Loadable<HostHealthCheck> = unloaded();

    public setHealth(health: Loadable<HostHealthCheck>): void {
        this._health = health;
        this._onHealthChanged.fire();
    }

    public get health(): Loadable<HostHealthCheck> {
        return this._health;
    }
}
