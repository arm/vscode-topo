import * as vscode from 'vscode';
import { Loadable, loaded } from '../util/loadable';
import { ContainerItem } from '../util/types';
import { TargetHealthCheck } from '../topoCliSchema';

const defaultContainerState = loaded([]);
const defaultTargetHealth = loaded(undefined);

export class SelectedTargetModel {
    private _onHealthChanged: vscode.EventEmitter<void> =
        new vscode.EventEmitter<void>();
    public readonly onHealthChanged: vscode.Event<void> =
        this._onHealthChanged.event;

    private _onContainersChanged: vscode.EventEmitter<void> =
        new vscode.EventEmitter<void>();
    public readonly onContainersChanged: vscode.Event<void> =
        this._onContainersChanged.event;

    private _health?: Loadable<TargetHealthCheck | undefined>;
    private _containers?: Loadable<ContainerItem[]>;

    public get health(): Loadable<TargetHealthCheck | undefined> {
        return this._health ?? defaultTargetHealth;
    }

    public setHealth(state: Loadable<TargetHealthCheck | undefined>) {
        this._health = state;
        this._onHealthChanged.fire();
    }

    public get containers(): Loadable<ContainerItem[]> {
        return this._containers ?? defaultContainerState;
    }

    public setContainers(containers: Loadable<ContainerItem[]>) {
        this._containers = containers;
        this._onContainersChanged.fire();
    }

    public clear(): void {
        this._health = undefined;
        this._containers = undefined;
        this._onHealthChanged.fire();
        this._onContainersChanged.fire();
    }
}
