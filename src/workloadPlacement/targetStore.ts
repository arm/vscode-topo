import * as vscode from 'vscode';
import { logger } from '../util/logger';
import debounce from 'lodash.debounce';
import { Target } from './target';
import { getErrorMessage } from '../util/getErrorMessage';

type GlobalStoreKeys = 'targets';
type WorkspaceStoreKeys = 'selectedTarget';
export type TargetStoreContext = Pick<vscode.ExtensionContext, 'globalState' | 'workspaceState' | 'globalStorageUri'>;

export class TargetStore {
    private static instance: TargetStore | undefined;

    public static getInstance(context?: TargetStoreContext): TargetStore {
        if (!TargetStore.instance) {
            if (!context) {
                throw new Error('TargetStore not initialized. Context is required when initializing the TargetStore.');
            }
            TargetStore.instance = new TargetStore(context);
        }
        return TargetStore.instance;
    }

    private _onChanged: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onChanged: vscode.Event<void> = this._onChanged.event;
    private disposables: vscode.Disposable[] = [];

    private constructor(protected context: TargetStoreContext) {
        const pattern = new vscode.RelativePattern(this.context.globalStorageUri, 'targets-update.signal');
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

    public async deactivate(): Promise<void> {
        this.dispose();
    }

    // Debounced function to publish a change to other VS Code instances
    protected publishChange = debounce(async () => {
        try {
            const signalUri = vscode.Uri.joinPath(this.context.globalStorageUri, 'targets-update.signal');
            const payload = new TextEncoder().encode(Date.now().toString());
            await vscode.workspace.fs.writeFile(signalUri, payload);
        } catch (err: unknown) {
            logger.error(`Failed to publish target change signal: ${getErrorMessage(err)}`);
        }
    }, 500);

    public get selected(): string | undefined {
        return this.getWorkspace('selectedTarget');
    }

    public async setSelected(id: string | undefined): Promise<void> {
        await this.setWorkspace('selectedTarget', id);
        this._onChanged.fire();
    }

    public getTargets(): Target[] {
        const targets = this.loadTargets();
        return [...targets.values()];
    }

    public async addTarget(target: Target): Promise<void> {
        const targets = this.loadTargets();
        if (targets.has(target.id)) {
            throw new Error(`Target with id "${target.id}" already exists`);
        }
        targets.set(target.id, target);
        await this.saveTargets(targets);
    }

    public async getSelectedTarget(): Promise<Target | undefined> {
        const targets = this.getTargets();
        return targets.find(target => target.id === this.selected);
    }

    public async deleteTarget(target: Target): Promise<void> {
        const targets = this.loadTargets();
        targets.delete(target.id);
        await this.saveTargets(targets);
    }

    protected loadTargets(): Map<string, Target> {
        try {
            const targets = this.getGlobal('targets');
            const parsed = targets ? JSON.parse(targets) : {};
            const rawEntries = Object.entries(parsed);
            const entries: [string, Target][] = [];
            for (const [k, v] of rawEntries) {
                try {
                    entries.push([k, Target.from(v as Record<string, unknown>)]);
                } catch (err) {
                    throw new Error(`Failed to parse target entry for key "${k}": ${getErrorMessage(err)}`);
                }
            }
            return new Map(entries);
        } catch (err) {
            const errorMsg = `Failed to load targets: ${getErrorMessage(err)}`;
            logger.error(errorMsg);
            throw Error(errorMsg);
        }
    }

    protected async saveTargets(targets: Map<string, Target>): Promise<void> {
        const plain: Record<string, unknown> = {};
        for (const [k, v] of targets.entries()) {
            plain[k] = v.toJSON();
        }
        await this.setGlobal('targets', JSON.stringify(plain));
    }

    protected getGlobal(key: GlobalStoreKeys): string | undefined {
        return this.get(this.context.globalState, key);
    }

    protected async setGlobal(key: GlobalStoreKeys, value: string | undefined): Promise<void> {
        await this.set(this.context.globalState, key, value);

        if (vscode.env.uiKind === vscode.UIKind.Desktop) {
            this.publishChange();
        }
    }

    protected getWorkspace(key: WorkspaceStoreKeys): string | undefined {
        return this.get(this.context.workspaceState, key);
    }

    protected setWorkspace(key: WorkspaceStoreKeys, value: string | undefined): Promise<void> {
        return this.set(this.context.workspaceState, key, value);
    }

    protected get(memento: vscode.Memento, key: GlobalStoreKeys | WorkspaceStoreKeys): string | undefined {
        const value = memento.get<string>(key);
        logger.debug(`Reading state ${key}: ${value}`);
        return value;
    }

    protected async set(memento: vscode.Memento, key: GlobalStoreKeys | WorkspaceStoreKeys, value: string | undefined): Promise<void> {
        logger.debug(`Writing state ${key}: ${value}`);
        await memento.update(key, value);
    }

    public dispose(): void {
        this.publishChange.cancel();
        for (const d of this.disposables) {
            try {
                d.dispose();
            } catch (err) {
                logger.error(`Error disposing TargetStore disposable: ${getErrorMessage(err)}`);
            }
        }
        this.disposables = [];
        TargetStore.instance = undefined;
    }
}
