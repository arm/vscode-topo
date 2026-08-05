import * as vscode from 'vscode';
import { HostHealthReport } from '../services/topoCliSchema';
import { Loadable, unloaded } from '../util/loadable';
import { TopoSkillStatus } from '../util/types';

export class HostModel implements vscode.Disposable {
    private _onHealthChanged: vscode.EventEmitter<void> =
        new vscode.EventEmitter<void>();
    public readonly onHealthChanged: vscode.Event<void> =
        this._onHealthChanged.event;

    private _onSkillStatusChanged: vscode.EventEmitter<void> =
        new vscode.EventEmitter<void>();
    public readonly onSkillStatusChanged: vscode.Event<void> =
        this._onSkillStatusChanged.event;

    private _health: Loadable<HostHealthReport> = unloaded();
    private _skillStatus: Loadable<TopoSkillStatus> = unloaded();

    public setHealth(health: Loadable<HostHealthReport>): void {
        this._health = health;
        this._onHealthChanged.fire();
    }

    public get health(): Loadable<HostHealthReport> {
        return this._health;
    }

    public setSkillStatus(skillStatus: Loadable<TopoSkillStatus>): void {
        this._skillStatus = skillStatus;
        this._onSkillStatusChanged.fire();
    }

    public get skillStatus(): Loadable<TopoSkillStatus> {
        return this._skillStatus;
    }

    public dispose(): void {
        this._onHealthChanged.dispose();
        this._onSkillStatusChanged.dispose();
    }
}
