import * as vscode from 'vscode';
import { HostHealthCheck } from '../services/topoCliSchema';
import { Loadable, unloaded } from '../util/loadable';
import { TopoSkillReport } from '../services/topoSkill';
import type { ContainerEngine } from '../manifest';

export class HostModel implements vscode.Disposable {
    private readonly _onContainerEngineChanged =
        new vscode.EventEmitter<void>();
    public readonly onContainerEngineChanged =
        this._onContainerEngineChanged.event;

    private _onHealthChanged: vscode.EventEmitter<void> =
        new vscode.EventEmitter<void>();
    public readonly onHealthChanged: vscode.Event<void> =
        this._onHealthChanged.event;

    private _onSkillReportChanged: vscode.EventEmitter<void> =
        new vscode.EventEmitter<void>();
    public readonly onSkillReportChanged: vscode.Event<void> =
        this._onSkillReportChanged.event;

    private _health: Loadable<HostHealthCheck[]> = unloaded();
    private _skillReport: Loadable<TopoSkillReport> = unloaded();
    private _containerEngine: ContainerEngine = 'docker';

    public get containerEngine(): ContainerEngine {
        return this._containerEngine;
    }

    public setContainerEngine(engine: ContainerEngine): void {
        if (this._containerEngine === engine) {
            return;
        }
        this._containerEngine = engine;
        this._onContainerEngineChanged.fire();
    }

    public setHealth(health: Loadable<HostHealthCheck[]>): void {
        this._health = health;
        this._onHealthChanged.fire();
    }

    public get health(): Loadable<HostHealthCheck[]> {
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
        this._onContainerEngineChanged.dispose();
        this._onHealthChanged.dispose();
        this._onSkillReportChanged.dispose();
    }
}
