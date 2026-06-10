import * as vscode from 'vscode';
import { Loadable, loaded } from '../util/loadable';
import { TargetHealthCheck } from '../topoCliSchema';
import { ContainerItem } from '../util/types';

const defaultContainers: Loadable<ContainerItem[]> = loaded([]);
const defaultHealth: Loadable<TargetHealthCheck | undefined> =
    loaded(undefined);

export class TargetModel {
    private _onSelectedChanged: vscode.EventEmitter<void> =
        new vscode.EventEmitter<void>();
    public readonly onSelectedChanged: vscode.Event<void> =
        this._onSelectedChanged.event;

    private _onTargetsChanged: vscode.EventEmitter<void> =
        new vscode.EventEmitter<void>();
    public readonly onTargetsChanged: vscode.Event<void> =
        this._onTargetsChanged.event;

    private _onHealthChanged: vscode.EventEmitter<void> =
        new vscode.EventEmitter<void>();
    public readonly onHealthChanged: vscode.Event<void> =
        this._onHealthChanged.event;

    private _onContainersChanged: vscode.EventEmitter<void> =
        new vscode.EventEmitter<void>();
    public readonly onContainersChanged: vscode.Event<void> =
        this._onContainersChanged.event;

    private _selected?: string;
    private _targets: string[] = [];
    private _health: Loadable<TargetHealthCheck | undefined> = defaultHealth;
    private _containers: Loadable<ContainerItem[]> = defaultContainers;

    public setSelected(selected: string | undefined): void {
        const changed = this._selected !== selected;
        this._selected = selected;
        if (changed) {
            this.clearSelectedTargetData();
            this._onSelectedChanged.fire();
        }
    }

    public setTargets(targets: string[]): void {
        this._targets = targets;
        this._onTargetsChanged.fire();
    }

    public get selected(): string | undefined {
        return this._selected;
    }

    public get targets(): string[] {
        return this._targets;
    }

    public get selectedTargetHealth(): Loadable<TargetHealthCheck | undefined> {
        return this._health;
    }

    public setSelectedTargetHealth(
        state: Loadable<TargetHealthCheck | undefined>,
    ) {
        this._health = state;
        this._onHealthChanged.fire();
    }

    public get selectedTargetContainers(): Loadable<ContainerItem[]> {
        return this._containers;
    }

    public setSelectedTargetContainers(containers: Loadable<ContainerItem[]>) {
        this._containers = containers;
        this._onContainersChanged.fire();
    }

    public clearSelectedTargetData(): void {
        this.setSelectedTargetHealth(defaultHealth);
        this.setSelectedTargetContainers(defaultContainers);
    }
}
