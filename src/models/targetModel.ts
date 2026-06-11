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
    private _onDataStoreCorruptionChanged: vscode.EventEmitter<void> =
        new vscode.EventEmitter<void>();
    public readonly onDataStoreCorruptionChanged: vscode.Event<void> =
        this._onDataStoreCorruptionChanged.event;

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
    private _dataStoreCorrupted = false;
    private _health: Loadable<TargetHealthCheck | undefined> = defaultHealth;
    private _containers: Loadable<ContainerItem[]> = defaultContainers;

    public setSelected(selected: string | undefined): void {
        this.updateSelected(selected);
        this.clearDataStoreCorruption();
    }

    public setTargets(targets: string[]): void {
        this.updateTargets(targets);
        this.clearDataStoreCorruption();
    }

    public setDataStoreCorrupted(): void {
        const dataStoreCorruptionChanged = !this._dataStoreCorrupted;
        this._dataStoreCorrupted = true;
        this.clearTargetState();

        if (dataStoreCorruptionChanged) {
            this._onDataStoreCorruptionChanged.fire();
        }
    }

    public clear(): void {
        this.clearTargetState();
        this.clearDataStoreCorruption();
    }

    public get selected(): string | undefined {
        return this._selected;
    }

    public get targets(): string[] {
        return this._targets;
    }

    public get dataIssue(): boolean {
        return this._dataStoreCorrupted;
    }

    private clearDataStoreCorruption(): void {
        const dataStoreCorruptionCleared = this._dataStoreCorrupted;
        this._dataStoreCorrupted = false;
        if (dataStoreCorruptionCleared) {
            this._onDataStoreCorruptionChanged.fire();
        }
    }

    private clearTargetState(): void {
        this.updateTargets([]);
        const selectedChanged = this.updateSelected(undefined);
        if (!selectedChanged) {
            this.clearSelectedTargetData();
        }
    }

    private updateSelected(selected: string | undefined): boolean {
        const changed = this._selected !== selected;
        this._selected = selected;
        if (changed) {
            this.clearSelectedTargetData();
            this._onSelectedChanged.fire();
        }
        return changed;
    }

    private updateTargets(targets: string[]): void {
        const changed = this._targets !== targets;
        this._targets = targets;
        if (changed) {
            this._onTargetsChanged.fire();
        }
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
