import * as vscode from 'vscode';
import { logger } from '../util/logger';
import debounce from 'lodash.debounce';
import { TargetItem } from '../util/types';
import { string, type, assert, record } from 'superstruct';

type GlobalStoreKeys = 'targets';
type WorkspaceStoreKeys = 'selectedTarget';

const serializedTargetsSchema = record(
    string(),
    type({
        ssh: string(),
    }),
);

export class TargetStore {
    private static instance: TargetStore | undefined;

    public static getInstance(context?: vscode.ExtensionContext): TargetStore {
        if (!TargetStore.instance) {
            if (!context) {
                throw new Error(
                    'TargetStore not initialized. Context is required when initializing the TargetStore.',
                );
            }
            TargetStore.instance = new TargetStore(context);
        }
        return TargetStore.instance;
    }

    private _onChanged: vscode.EventEmitter<void> =
        new vscode.EventEmitter<void>();
    public readonly onChanged: vscode.Event<void> = this._onChanged.event;
    private disposables: vscode.Disposable[] = [];

    private constructor(protected context: vscode.ExtensionContext) {
        const pattern = new vscode.RelativePattern(
            this.context.globalStorageUri,
            'targets-update.signal',
        );
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);
        watcher.onDidCreate(() => {
            if (!vscode.window.state.focused) {
                this._onChanged.fire();
            }
        });
        watcher.onDidChange(() => {
            if (!vscode.window.state.focused) {
                this._onChanged.fire();
            }
        });
        this.disposables.push(watcher, this._onChanged);
    }

    // Debounced function to publish a change to other VS Code instances
    protected publishChange = debounce(async () => {
        try {
            const signalUri = vscode.Uri.joinPath(
                this.context.globalStorageUri,
                'targets-update.signal',
            );
            const payload = new TextEncoder().encode(Date.now().toString());
            await vscode.workspace.fs.writeFile(signalUri, payload);
        } catch (err: unknown) {
            logger.error(`Failed to publish target change signal`, err);
        }
    }, 500);

    public get selected(): string | undefined {
        return this.getWorkspace('selectedTarget');
    }

    public async setSelected(id: string | undefined): Promise<void> {
        await this.setWorkspace('selectedTarget', id);
        this._onChanged.fire();
    }

    public getTargets(): TargetItem[] {
        const targets = this.loadTargets();
        return [...targets.values()];
    }

    public async addTarget(target: TargetItem): Promise<void> {
        const targets = this.loadTargets();
        if (targets.has(target.ssh)) {
            throw new Error(`Target "${target.ssh}" already exists`);
        }
        targets.set(target.ssh, target);
        await this.saveTargets(targets);
    }

    public async updateTarget(target: TargetItem): Promise<void> {
        const targets = this.loadTargets();
        if (!targets.has(target.ssh)) {
            throw new Error(`Target "${target.ssh}" does not exist`);
        }
        targets.set(target.ssh, target);
        await this.saveTargets(targets);
        this._onChanged.fire();
    }

    public async getSelectedTarget(): Promise<TargetItem | undefined> {
        const targets = this.getTargets();
        return targets.find((target) => target.ssh === this.selected);
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
            const remaining = [...targets.keys()];
            const newSelected = remaining.length
                ? remaining.sort((a, b) => a.localeCompare(b))[0]
                : undefined;
            await this.setSelected(newSelected);
        }
    }

    protected loadTargets(): Map<string, TargetItem> {
        try {
            const rawTargets = this.getGlobal('targets');
            const targets = rawTargets ? JSON.parse(rawTargets) : {};
            assert(targets, serializedTargetsSchema);
            return new Map(Object.entries(targets));
        } catch (err) {
            const errorMsg = 'Failed to load targets';
            logger.error(errorMsg, err);
            throw Error(errorMsg, { cause: err });
        }
    }

    protected async saveTargets(
        targets: Map<string, TargetItem>,
    ): Promise<void> {
        const json = JSON.stringify(Object.fromEntries(targets));
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

        if (vscode.env.uiKind === vscode.UIKind.Desktop) {
            this.publishChange();
        }
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
        this.publishChange.cancel();
        for (const d of this.disposables) {
            try {
                d.dispose();
            } catch (err) {
                logger.error(`Error disposing TargetStore disposable`, err);
            }
        }
        this.disposables = [];
        TargetStore.instance = undefined;
    }
}
