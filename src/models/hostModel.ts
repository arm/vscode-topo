import * as vscode from 'vscode';
import { HostHealthCheckResult } from '../topoCliSchema';
import { Loadable } from '../util/types';

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

    private _health?: Loadable<HostHealthCheckResult>;

    public setHealth(health: Loadable<HostHealthCheckResult>): void {
        this._health = health;
        this._onHealthChanged.fire();
    }

    public get health(): Loadable<HostHealthCheckResult> {
        return (
            this._health ?? { status: 'loaded', data: defaultHealthCheckResult }
        );
    }
}
