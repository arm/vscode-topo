import * as vscode from 'vscode';
import { TargetStore } from './targetStore';
import { Target } from './target';
import { mutable } from '../util/mutable';
import { mock, MockProxy } from 'jest-mock-extended';

jest.mock('../util/logger');

const waitImmediate = async () => {
    await Promise.resolve();
    await Promise.resolve();
};

function createMockContext(): {
    context: vscode.ExtensionContext;
    globalState: MockProxy<vscode.Memento>;
    workspaceState: MockProxy<vscode.Memento>;
} {
    const globalMap = new Map<string, unknown>();
    const workspaceMap = new Map<string, unknown>();

    const globalState = mock<vscode.ExtensionContext['globalState']>();
    globalState.get.mockImplementation(
        (key: string, defaultValue?: unknown) => {
            if (!globalMap.has(key)) {
                return defaultValue;
            }
            return globalMap.get(key);
        },
    );
    globalState.update.mockImplementation(
        async (key: string, value: unknown) => {
            globalMap.set(key, value);
        },
    );

    const workspaceState = mock<vscode.ExtensionContext['workspaceState']>();
    workspaceState.get.mockImplementation(
        (key: string, defaultValue?: unknown) => {
            if (!workspaceMap.has(key)) {
                return defaultValue;
            }
            return workspaceMap.get(key);
        },
    );
    workspaceState.update.mockImplementation(
        async (key: string, value: unknown) => {
            workspaceMap.set(key, value);
        },
    );

    const globalStorageUri = vscode.Uri.parse('file:///fake/globalStorage');

    const context = mock<vscode.ExtensionContext>({
        globalState,
        workspaceState,
        globalStorageUri,
    });

    return { context, globalState, workspaceState };
}

describe('TargetStore', () => {
    const emitter = new vscode.EventEmitter<vscode.Uri>();
    const fsWatchers: {
        pattern: vscode.GlobPattern;
        watcher: vscode.FileSystemWatcher;
    }[] = [];
    jest.mocked(vscode.workspace.createFileSystemWatcher).mockImplementation(
        (pattern) => {
            const watcher: vscode.FileSystemWatcher = {
                onDidCreate: emitter.event,
                onDidChange: emitter.event,
                onDidDelete: emitter.event,
                dispose: () => {},
                ignoreCreateEvents: false,
                ignoreChangeEvents: false,
                ignoreDeleteEvents: false,
            };
            fsWatchers.push({ pattern, watcher });
            return watcher;
        },
    );
    jest.mocked(vscode.workspace.fs.writeFile).mockImplementation(
        async (uri, _content) => {
            for (const _entry of fsWatchers) {
                emitter.fire(uri);
            }
        },
    );

    beforeEach(() => {
        mutable(vscode.window).state = {
            focused: true,
            active: true,
        };
        jest.clearAllMocks();
    });

    afterEach(() => {
        try {
            TargetStore.getInstance().dispose();
        } catch (err) {
            if (
                !(err instanceof Error) ||
                !err.message.includes('TargetStore not initialized')
            ) {
                throw err;
            }
        }
    });

    it('adds a target successfully and persists it', async () => {
        const { context } = createMockContext();
        const store = TargetStore.getInstance(context);
        const t = new Target('success@example.com');

        const addTargetOperation = store.addTarget(t);

        await expect(addTargetOperation).resolves.toBeUndefined();
        const targets = store.getTargets();
        expect(targets.some((x) => x.ssh === t.ssh)).toBe(true);
        const raw = context.globalState.get('targets') as string | undefined;
        expect(typeof raw).toBe('string');
        const parsed = JSON.parse(raw || '{}');
        expect(parsed[t.ssh]).toBeDefined();
        expect(parsed[t.ssh].ssh).toBe(t.ssh);
    });

    it('throws an error when addTarget fails', async () => {
        const { context, globalState } = createMockContext();
        globalState.update.mockRejectedValue(new Error('persist-fail'));
        const store = TargetStore.getInstance(context);
        const t = new Target('fail@example.com');

        const addTargetOperation = store.addTarget(t);

        await expect(addTargetOperation).rejects.toThrow('persist-fail');
        const raw = context.globalState.get('targets') as string | undefined;
        expect(raw).toBeUndefined();
    });

    it('persists targets via setTarget and exposes them via getTargets', async () => {
        const { context } = createMockContext();
        const store = TargetStore.getInstance(context);

        const t = new Target('alice@example.com');
        await store.addTarget(t);

        const targets = store.getTargets();
        expect(targets.some((x) => x.ssh === t.ssh)).toBe(true);

        const raw = context.globalState.get('targets') as string | undefined;
        expect(typeof raw).toBe('string');
        const parsed = JSON.parse(raw || '{}');
        expect(parsed[t.ssh]).toBeDefined();
        expect(parsed[t.ssh].ssh).toBe(t.ssh);
    });

    it('stores selected target and fires onChanged when setSelected is called', async () => {
        const { context } = createMockContext();
        const store = TargetStore.getInstance(context);
        const t = new Target('bob@example.com');
        await store.addTarget(t);
        const cb = jest.fn();
        store.onChanged(cb);

        await store.setSelected('bob@example.com');

        expect(context.workspaceState.get('selectedTarget')).toBe(
            'bob@example.com',
        );
        expect(cb).toHaveBeenCalled();
    });

    it('returns the selected Target via getSelectedTarget', async () => {
        const { context } = createMockContext();
        const store = TargetStore.getInstance(context);

        const t = new Target('carol@example.com');
        await store.addTarget(t);
        await store.setSelected('carol@example.com');

        const selected = await store.getSelectedTarget();
        expect(selected).toBeDefined();
        expect(selected?.ssh).toBe('carol@example.com');
    });

    it('fires onChanged when signal file is modified externally and window is not focused', async () => {
        const { context } = createMockContext();
        const store = TargetStore.getInstance(context);
        const cb = jest.fn();
        store.onChanged(cb);
        mutable(vscode.window.state).focused = false;
        const signalUri = vscode.Uri.joinPath(
            context.globalStorageUri,
            'targets-update.signal',
        );

        await vscode.workspace.fs.writeFile(
            signalUri,
            new TextEncoder().encode('1'),
        );
        await waitImmediate();

        expect(cb).toHaveBeenCalled();
    });

    it('deactivates the store, disposing resources and clearing the singleton', async () => {
        const { context } = createMockContext();
        const store = TargetStore.getInstance(context);
        await store.addTarget(new Target('d@example.com'));
        const cb = jest.fn();
        store.onChanged(cb);

        store.dispose();

        const newStore = TargetStore.getInstance(context);
        expect(newStore).not.toBe(store);
    });

    it('removes a non-selected target without changing selection', async () => {
        const { context } = createMockContext();
        const store = TargetStore.getInstance(context);
        const t1 = new Target('a@example.com');
        const t2 = new Target('b@example.com');
        await store.addTarget(t1);
        await store.addTarget(t2);
        await store.setSelected(t1.ssh);

        await store.deleteTarget(t2.ssh);

        const targets = store.getTargets();
        expect(targets.some((t) => t.ssh === t2.ssh)).toBe(false);
        const selected = await store.getSelectedTarget();
        expect(selected).toBeDefined();
    });

    it('removes the selected target and falls back to the first remaining target', async () => {
        const { context } = createMockContext();
        const store = TargetStore.getInstance(context);
        const t1 = new Target('one@example.com');
        const t2 = new Target('two@example.com');
        const t3 = new Target('three@example.com');
        await store.addTarget(t1);
        await store.addTarget(t2);
        await store.addTarget(t3);
        await store.setSelected(t2.ssh);

        await store.deleteTarget(t2.ssh);

        const targets = store.getTargets();
        expect(targets.some((t) => t.ssh === t2.ssh)).toBe(false);
        const selected = await store.getSelectedTarget();
        expect(selected).toBeDefined();
        expect(selected?.ssh).toBe(t1.ssh);
    });

    it('removes the only selected target and clears selection when none remain', async () => {
        const { context } = createMockContext();
        const store = TargetStore.getInstance(context);
        const lone = new Target('only@example.com');
        await store.addTarget(lone);
        await store.setSelected(lone.ssh);

        await store.deleteTarget(lone.ssh);

        const targets = store.getTargets();
        expect(targets.length).toBe(0);
        const selected = await store.getSelectedTarget();
        expect(selected).toBeUndefined();
    });

    it('throws when deleting a non-existent target id', async () => {
        const { context } = createMockContext();
        const store = TargetStore.getInstance(context);

        const deleteTargetOperation = store.deleteTarget('no-such-id');

        await expect(deleteTargetOperation).rejects.toThrow('does not exist');
    });
});
