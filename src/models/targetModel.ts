import * as vscode from 'vscode';

export class TargetModel {
    private _onSelectedChanged: vscode.EventEmitter<void> =
        new vscode.EventEmitter<void>();
    public readonly onSelectedChanged: vscode.Event<void> =
        this._onSelectedChanged.event;
    private _onTargetsChanged: vscode.EventEmitter<void> =
        new vscode.EventEmitter<void>();
    public readonly onTargetsChanged: vscode.Event<void> =
        this._onTargetsChanged.event;

    private _selected?: string;
    private _targets: string[] = [];

    public setSelected(selected: string | undefined): void {
        this._selected = selected;
        this._onSelectedChanged.fire();
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
}
