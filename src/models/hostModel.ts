import * as vscode from 'vscode';
import { HostHealth } from './health';
import { Loadable, unloaded } from '../util/loadable';
import { TopoSkillReport } from '../services/topoSkill';

export class HostModel implements vscode.Disposable {
    private _onHealthChanged: vscode.EventEmitter<void> =
        new vscode.EventEmitter<void>();
    public readonly onHealthChanged: vscode.Event<void> =
        this._onHealthChanged.event;

    private _onSkillReportChanged: vscode.EventEmitter<void> =
        new vscode.EventEmitter<void>();
    public readonly onSkillReportChanged: vscode.Event<void> =
        this._onSkillReportChanged.event;

    private _health: Loadable<HostHealth> = unloaded();
    private _skillReport: Loadable<TopoSkillReport> = unloaded();

    public setHealth(health: Loadable<HostHealth>): void {
        this._health = health;
        this._onHealthChanged.fire();
    }

    public get health(): Loadable<HostHealth> {
        return this._health;
    }

    public setSkillReport(skillReport: Loadable<TopoSkillReport>): void {
        this._skillReport = skillReport;
        this._onSkillReportChanged.fire();
    }

    public get skillReport(): Loadable<TopoSkillReport> {
        return this._skillReport;
    }

    public dispose(): void {
        this._onHealthChanged.dispose();
        this._onSkillReportChanged.dispose();
    }
}
