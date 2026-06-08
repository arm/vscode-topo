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
    private _onDataIssueChanged: vscode.EventEmitter<void> =
        new vscode.EventEmitter<void>();
    public readonly onDataIssueChanged: vscode.Event<void> =
        this._onDataIssueChanged.event;

    private _selected?: string;
    private _targets: string[] = [];
    private _dataIssue = false;

    public setSelected(selected: string | undefined): void {
        this._selected = selected;
        const dataIssueCleared = this.clearDataIssue();
        this._onSelectedChanged.fire();
        if (dataIssueCleared) {
            this._onDataIssueChanged.fire();
        }
    }

    public setTargets(targets: string[]): void {
        this._targets = targets;
        const dataIssueCleared = this.clearDataIssue();
        this._onTargetsChanged.fire();
        if (dataIssueCleared) {
            this._onDataIssueChanged.fire();
        }
    }

    public setDataIssue(issue: boolean): void {
        this._dataIssue = issue;
        const targetsChanged = issue && this._targets.length > 0;
        const selectedChanged = issue && this._selected !== undefined;
        if (issue) {
            this._targets = [];
            this._selected = undefined;
        }

        this._onDataIssueChanged.fire();
        if (targetsChanged) {
            this._onTargetsChanged.fire();
        }
        if (selectedChanged) {
            this._onSelectedChanged.fire();
        }
    }

    public get selected(): string | undefined {
        return this._selected;
    }

    public get targets(): string[] {
        return this._targets;
    }

    public get dataIssue(): boolean {
        return this._dataIssue;
    }

    private clearDataIssue(): boolean {
        const dataIssueCleared = this._dataIssue;
        this._dataIssue = false;
        return dataIssueCleared;
    }
}
