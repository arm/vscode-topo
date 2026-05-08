import * as vscode from 'vscode';
import { logger } from '../util/logger';
import { string, type, assert, record } from 'superstruct';

type GlobalStoreKeys = 'targets';
type WorkspaceStoreKeys = 'selectedTarget';

// serialized as { [target: string]: {} }; values are empty objects for backwards compatibility
const serializedTargetsSchema = record(string(), type({}));

export class TargetStore {
    private _onSelectedTargetChanged = new vscode.EventEmitter<void>();
    public readonly onSelectedTargetChanged =
        this._onSelectedTargetChanged.event;
    private disposables: vscode.Disposable[] = [];

    constructor(protected context: vscode.ExtensionContext) {
        this.disposables.push(this._onSelectedTargetChanged);
    }

    public get selected(): string | undefined {
        return this.getWorkspace('selectedTarget');
    }

    public async setSelected(id: string | undefined): Promise<void> {
        await this.setWorkspace('selectedTarget', id);
        this._onSelectedTargetChanged.fire();
    }

    public getTargets(): string[] {
        const targets = this.loadTargets();
        return [...targets.values()];
    }

    public async addTarget(target: string): Promise<void> {
        const targets = this.loadTargets();
        if (targets.has(target)) {
            throw new Error(`Target "${target}" already exists`);
        }
        targets.add(target);
        await this.saveTargets(targets);
    }

    public async getSelectedTarget(): Promise<string | undefined> {
        const targets = this.getTargets();
        return targets.find((target) => target === this.selected);
    }

    public async deleteTarget(ssh: string): Promise<void> {
        const targets = this.loadTargets();
        if (!targets.has(ssh)) {
            throw new Error(`Target "${ssh}" does not exist`);
        }
        targets.delete(ssh);
        await this.saveTargets(targets);
        const currentSelected = this.selected;
        if (currentSelected === ssh) {
            const remaining = [...targets];
            const newSelected = remaining.length
                ? remaining.sort((a, b) => a.localeCompare(b))[0]
                : undefined;
            await this.setSelected(newSelected);
        }
    }

    protected loadTargets(): Set<string> {
        try {
            const rawTargets = this.getGlobal('targets');
            const targets = rawTargets ? JSON.parse(rawTargets) : {};
            assert(targets, serializedTargetsSchema);
            return new Set(Object.keys(targets));
        } catch (err) {
            const errorMsg = 'Failed to load targets';
            logger.error(errorMsg, err);
            throw Error(errorMsg, { cause: err });
        }
    }

    protected async saveTargets(targets: Set<string>): Promise<void> {
        const json = JSON.stringify(
            Object.fromEntries([...targets].map((k) => [k, {}])),
        );
        await this.setGlobal('targets', json);
    }

    protected getGlobal(key: GlobalStoreKeys): string | undefined {
        return this.get(this.context.globalState, key);
    }

    protected async setGlobal(
        key: GlobalStoreKeys,
        value: string | undefined,
    ): Promise<void> {
        await this.set(this.context.globalState, key, value);
    }

    protected getWorkspace(key: WorkspaceStoreKeys): string | undefined {
        return this.get(this.context.workspaceState, key);
    }

    protected setWorkspace(
        key: WorkspaceStoreKeys,
        value: string | undefined,
    ): Promise<void> {
        return this.set(this.context.workspaceState, key, value);
    }

    protected get(
        memento: vscode.Memento,
        key: GlobalStoreKeys | WorkspaceStoreKeys,
    ): string | undefined {
        const value = memento.get<string>(key);
        logger.debug(`Reading state ${key}: ${value}`);
        return value;
    }

    protected async set(
        memento: vscode.Memento,
        key: GlobalStoreKeys | WorkspaceStoreKeys,
        value: string | undefined,
    ): Promise<void> {
        logger.debug(`Writing state ${key}: ${value}`);
        await memento.update(key, value);
    }

    public dispose(): void {
        for (const d of [...this.disposables].reverse()) {
            try {
                d.dispose();
            } catch (err) {
                logger.error(`Error disposing TargetStore disposable`, err);
            }
        }
        this.disposables = [];
    }
}
