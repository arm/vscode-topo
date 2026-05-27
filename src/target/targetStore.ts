import * as vscode from 'vscode';
import { logger } from '../util/logger';
import debounce from 'lodash.debounce';
import { string, type, assert, record } from 'superstruct';
import { WrappedError } from '../errors/wrappedError';
import { getErrorMessage } from '../util/getErrorMessage';

type GlobalStoreKeys = 'targets';
type WorkspaceStoreKeys = 'selectedTarget';

// serialized as { [target: string]: {} }; values are empty objects for backwards compatibility
const serializedTargetsSchema = record(string(), type({}));

export class TargetStore {
    private _onChanged: vscode.EventEmitter<void> =
        new vscode.EventEmitter<void>();
    public readonly onChanged: vscode.Event<void> = this._onChanged.event;
    private disposables: vscode.Disposable[] = [];

    constructor(protected context: vscode.ExtensionContext) {
        const pattern = new vscode.RelativePattern(
            this.context.globalStorageUri,
            'targets-update.signal',
        );
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);
        const onDidCreate = watcher.onDidCreate(() => {
            if (!vscode.window.state.focused) {
                this._onChanged.fire();
            }
        });
        const onDidChange = watcher.onDidChange(() => {
            if (!vscode.window.state.focused) {
                this._onChanged.fire();
            }
        });
        this.disposables.push(
            watcher,
            onDidCreate,
            onDidChange,
            this._onChanged,
        );
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

    public getSelectedTarget(): string | undefined {
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
        } else {
            this._onChanged.fire();
        }
    }

    protected loadTargets(): Set<string> {
        const rawTargets = this.getGlobal('targets');
        try {
            const targets = rawTargets ? JSON.parse(rawTargets) : {};
            assert(targets, serializedTargetsSchema);
            return new Set(Object.keys(targets));
        } catch (err) {
            const errorMsg = 'Failed to load targets';
            throw new WrappedError(
                'TARGET',
                errorMsg,
                [{ level: 'Error', msg: getErrorMessage(err) }],
                { cause: err },
            );
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
