import * as vscode from 'vscode';
import { logger } from '../util/logger';
import debounce from 'lodash.debounce';
import { string, type, assert, record } from 'superstruct';
import { DisposableCollector } from '../util/disposableCollector';
import { WrappedError } from '../errors/wrappedError';
import { getErrorMessage } from '../util/getErrorMessage';

type GlobalStoreKeys = 'targets';
type WorkspaceStoreKeys = 'selectedTarget';

// serialized as { [target: string]: {} }; values are empty objects for backwards compatibility
const serializedTargetsSchema = record(string(), type({}));

export class TargetStore {
    private readonly _onGlobalWrite = new vscode.EventEmitter<void>();
    public readonly onGlobalWrite: vscode.Event<void> =
        this._onGlobalWrite.event;

    private readonly disposables = new DisposableCollector();

    constructor(protected context: vscode.ExtensionContext) {
        const pattern = new vscode.RelativePattern(
            this.context.globalStorageUri,
            'targets-update.signal',
        );
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);
        const onDidCreate = watcher.onDidCreate(() => {
            if (!vscode.window.state.focused) {
                this._onGlobalWrite.fire();
            }
        });
        const onDidChange = watcher.onDidChange(() => {
            if (!vscode.window.state.focused) {
                this._onGlobalWrite.fire();
            }
        });
        this.disposables.collect(
            watcher,
            onDidCreate,
            onDidChange,
            this._onGlobalWrite,
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

    public loadSelected(): string | undefined {
        return this.getWorkspace('selectedTarget');
    }

    public async saveSelected(id: string | undefined): Promise<void> {
        await this.setWorkspace('selectedTarget', id);
    }

    public loadTargets(): Set<string> {
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

    public async saveTargets(targets: Set<string>): Promise<void> {
        const json = JSON.stringify(
            Object.fromEntries([...targets].map((k) => [k, {}])),
        );
        await this.setGlobal('targets', json);
    }

    protected getGlobal(key: GlobalStoreKeys): string | undefined {
        return this.get(this.context.globalState, key);
    }

    protected getWorkspace(key: WorkspaceStoreKeys): string | undefined {
        return this.get(this.context.workspaceState, key);
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
        this.disposables.dispose();
    }
}
