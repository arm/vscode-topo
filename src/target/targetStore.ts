import * as vscode from 'vscode';
import { logger } from '../util/logger';
import debounce from 'lodash.debounce';
import { string, type, assert, record } from 'superstruct';
import { DisposableCollector } from '../util/disposableCollector';
import { WrappedError } from '../errors/wrappedError';
import { getErrorMessage } from '../util/getErrorMessage';
import { assertValidSshDestination } from '../util/assertValidSshDestination';

type GlobalStoreKeys = 'targets';
type WorkspaceStoreKeys = 'selectedTarget';

// serialized as { [target: string]: {} }; values are empty objects for backwards compatibility
const serializedTargetsSchema = record(string(), type({}));

function get(
    memento: vscode.Memento,
    key: GlobalStoreKeys | WorkspaceStoreKeys,
): string | undefined {
    const value = memento.get<string>(key);
    logger.debug(`Reading state ${key}: ${value}`);
    return value;
}

async function set(
    memento: vscode.Memento,
    key: GlobalStoreKeys | WorkspaceStoreKeys,
    value: string | undefined,
): Promise<void> {
    logger.debug(`Writing state ${key}: ${value}`);
    await memento.update(key, value);
}

async function clearMemento(memento: vscode.Memento): Promise<void> {
    for (const key of memento.keys()) {
        logger.debug(`Clearing state ${key}`);
        await memento.update(key, undefined);
    }
}

function isFileNotFoundError(err: unknown): boolean {
    return err instanceof vscode.FileSystemError && err.code === 'FileNotFound';
}

export class TargetStore {
    private _onExternalTargetsChanged: vscode.EventEmitter<void> =
        new vscode.EventEmitter<void>();
    public readonly onExternalTargetsChanged: vscode.Event<void> =
        this._onExternalTargetsChanged.event;
    private readonly disposables = new DisposableCollector();

    constructor(protected context: vscode.ExtensionContext) {
        const pattern = new vscode.RelativePattern(
            this.context.globalStorageUri,
            'targets-update.signal',
        );
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);
        const onDidCreate = watcher.onDidCreate(() => {
            if (!vscode.window.state.focused) {
                this._onExternalTargetsChanged.fire();
            }
        });
        const onDidChange = watcher.onDidChange(() => {
            if (!vscode.window.state.focused) {
                this._onExternalTargetsChanged.fire();
            }
        });
        this.disposables.collect(
            watcher,
            onDidCreate,
            onDidChange,
            this._onExternalTargetsChanged,
        );
    }

    protected publishExternalTargetsChange = debounce(async () => {
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

    public async setSelected(target: string | undefined): Promise<void> {
        await this.setWorkspace('selectedTarget', target);
    }

    public async addTarget(target: string): Promise<void> {
        assertValidSshDestination(target);
        const targets = this.getTargets();
        if (targets.has(target)) {
            throw new Error(`Target "${target}" already exists`);
        }
        targets.add(target);
        await this.saveTargets(targets);
    }

    public getSelectedTarget(): string | undefined {
        const selected = this.getWorkspace('selectedTarget');
        const targets = this.getTargets();
        return selected && targets.has(selected) ? selected : undefined;
    }

    public async deleteTarget(target: string): Promise<void> {
        const targets = this.getTargets();
        if (!targets.has(target)) {
            throw new Error(`Target "${target}" does not exist`);
        }
        targets.delete(target);
        const currentSelected = this.getSelectedTarget();
        await this.saveTargets(targets);
        if (currentSelected === target) {
            await this.setSelected(undefined);
        }
    }

    public getTargets(): Set<string> {
        const rawTargets = this.getGlobal('targets');
        try {
            const targets = rawTargets ? JSON.parse(rawTargets) : {};
            assert(targets, serializedTargetsSchema);
            return new Set(Object.keys(targets));
        } catch (err) {
            const errorMsg = 'Failed to load targets';
            throw new WrappedError(
                'STORAGE',
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
        return get(this.context.globalState, key);
    }

    protected async setGlobal(
        key: GlobalStoreKeys,
        value: string | undefined,
    ): Promise<void> {
        await set(this.context.globalState, key, value);

        if (vscode.env.uiKind === vscode.UIKind.Desktop) {
            this.publishExternalTargetsChange();
        }
    }

    protected getWorkspace(key: WorkspaceStoreKeys): string | undefined {
        return get(this.context.workspaceState, key);
    }

    protected setWorkspace(
        key: WorkspaceStoreKeys,
        value: string | undefined,
    ): Promise<void> {
        return set(this.context.workspaceState, key, value);
    }

    public async resetExtensionData(): Promise<void> {
        await clearMemento(this.context.globalState);
        await clearMemento(this.context.workspaceState);

        try {
            await vscode.workspace.fs.delete(this.context.globalStorageUri, {
                recursive: true,
                useTrash: false,
            });
        } catch (err) {
            if (!isFileNotFoundError(err)) {
                throw err;
            }
        }

        await vscode.workspace.fs.createDirectory(
            this.context.globalStorageUri,
        );

        this.publishExternalTargetsChange();
    }

    public dispose(): void {
        this.publishExternalTargetsChange.cancel();
        this.disposables.dispose();
    }
}
