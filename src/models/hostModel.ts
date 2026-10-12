import * as vscode from 'vscode';
import type { HostHealth } from '../util/healthReport';
import { Loadable, errored, loaded, unloaded } from '../util/loadable';
import { TopoSkillReport } from '../services/topoSkill';
import {
    type ContainerEngine,
    type ContainerEngineSetting,
    resolveContainerEngine,
} from '../util/resolveContainerEngine';

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

    private _health: Loadable<HostHealth> = unloaded();
    private _skillReport: Loadable<TopoSkillReport> = unloaded();
    private _settingsContainerEngine: ContainerEngineSetting = 'auto';
    private _environmentContainerEngine?: string;

    public get containerEngine(): Loadable<ContainerEngine> {
        try {
            return loaded(
                resolveContainerEngine(
                    this._settingsContainerEngine,
                    this._environmentContainerEngine,
                ),
            );
        } catch (error) {
            return errored(error);
        }
    }

    public setContainerEngine(
        settingsContainerEngine: ContainerEngineSetting,
        environmentContainerEngine?: string,
    ): void {
        this._settingsContainerEngine = settingsContainerEngine;
        this._environmentContainerEngine = environmentContainerEngine;
        this._onContainerEngineChanged.fire();
    }

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
        this._onContainerEngineChanged.dispose();
        this._onHealthChanged.dispose();
        this._onSkillReportChanged.dispose();
    }
}
