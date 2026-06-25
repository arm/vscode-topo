import * as vscode from 'vscode';
import { Loadable, unloaded } from '../util/loadable';
import { TargetHealthReport } from '../topoCliSchema';
import { ContainerItem, TargetDescription } from '../util/types';

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

    private _onDescriptionChanged: vscode.EventEmitter<void> =
        new vscode.EventEmitter<void>();
    public readonly onDescriptionChanged: vscode.Event<void> =
        this._onDescriptionChanged.event;

    private _selected?: string;
    private _targets: Loadable<string[]> = unloaded();
    private _health: Loadable<TargetHealthReport> = unloaded();
    private _containers: Loadable<ContainerItem[]> = unloaded();
    private _description: Loadable<TargetDescription> = unloaded();

    public setSelected(selected: string | undefined): void {
        const changed = this._selected !== selected;
        this._selected = selected;
        if (changed || selected === undefined) {
            this.clearSelectedTargetData();
        }
        if (changed) {
            this._onSelectedChanged.fire();
        }
    }

    public setTargets(targets: Loadable<string[]>): void {
        const changed = this._targets !== targets;
        this._targets = targets;
        if (changed) {
            this._onTargetsChanged.fire();
        }
    }

    public setSelectedTargetHealth(state: Loadable<TargetHealthReport>) {
        const changed = this._health !== state;
        this._health = state;
        if (changed) {
            this._onHealthChanged.fire();
        }
    }

    public setSelectedTargetContainers(containers: Loadable<ContainerItem[]>) {
        const changed = this._containers !== containers;
        this._containers = containers;
        if (changed) {
            this._onContainersChanged.fire();
        }
    }

    public clear(): void {
        this.setTargets(unloaded());
        this.setSelected(undefined);
    }

    public get selected(): string | undefined {
        return this._selected;
    }

    public get targets(): Loadable<string[]> {
        return this._targets;
    }

    public get selectedTargetHealth(): Loadable<TargetHealthReport> {
        return this._health;
    }

    public get selectedTargetContainers(): Loadable<ContainerItem[]> {
        return this._containers;
    }

    public get selectedTargetDescription(): Loadable<TargetDescription> {
        return this._description;
    }

    public setSelectedTargetDescription(
        description: Loadable<TargetDescription>,
    ) {
        this._description = description;
        this._onDescriptionChanged.fire();
    }

    private clearSelectedTargetData(): void {
        this.setSelectedTargetHealth(unloaded());
        this.setSelectedTargetContainers(unloaded());
        this.setSelectedTargetDescription(unloaded());
    }
}
