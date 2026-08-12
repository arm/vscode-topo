import * as vscode from 'vscode';
import { HostHealthReport } from '../services/topoCliSchema';
import { Loadable, unloaded } from '../util/loadable';
import { TopoSkillAgent } from '../services/topoSkill';
import { TopoSkillStatus } from '../util/types';

export type TopoSkillStatusLoadables = Readonly<
    Record<TopoSkillAgent, Loadable<TopoSkillStatus>>
>;

export class HostModel implements vscode.Disposable {
    private _onHealthChanged: vscode.EventEmitter<void> =
        new vscode.EventEmitter<void>();
    public readonly onHealthChanged: vscode.Event<void> =
        this._onHealthChanged.event;

    private _onSkillStatusesChanged: vscode.EventEmitter<void> =
        new vscode.EventEmitter<void>();
    public readonly onSkillStatusesChanged: vscode.Event<void> =
        this._onSkillStatusesChanged.event;

    private _health: Loadable<HostHealthReport> = unloaded();
    private _skillStatuses: TopoSkillStatusLoadables = {
        codex: unloaded(),
        'claude-code': unloaded(),
    };

    public setHealth(health: Loadable<HostHealthReport>): void {
        this._health = health;
        this._onHealthChanged.fire();
    }

    public get health(): Loadable<HostHealthReport> {
        return this._health;
    }

    public setSkillStatus(
        agent: TopoSkillAgent,
        skillStatus: Loadable<TopoSkillStatus>,
    ): void {
        this._skillStatuses = {
            ...this._skillStatuses,
            [agent]: skillStatus,
        };
        this._onSkillStatusesChanged.fire();
    }

    public get skillStatuses(): TopoSkillStatusLoadables {
        return this._skillStatuses;
    }

    public dispose(): void {
        this._onHealthChanged.dispose();
        this._onSkillStatusesChanged.dispose();
    }
}
