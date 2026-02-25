import * as vscode from 'vscode';
import { TargetStore } from './targetStore';
import { Target } from './target';
import { mutable } from '../util/mutable';
import { mock, MockProxy } from 'jest-mock-extended';

jest.mock('../util/logger');

const yamlTargetDescription = `host:
    - model: Cortex-A55
      cores: 2
      features:
        - fp
        - asimd
        - evtstrm
        - aes
remoteprocs:
    - name: imx-rproc`;

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
        const t = new Target(
            't-success',
            'success@example.com',
            yamlTargetDescription,
        );

        const addTargetOperation = store.addTarget(t);

        await expect(addTargetOperation).resolves.toBeUndefined();
        const targets = store.getTargets();
        expect(targets.some((x) => x.id === 't-success')).toBe(true);
        const raw = context.globalState.get('targets') as string | undefined;
        expect(typeof raw).toBe('string');
        const parsed = JSON.parse(raw || '{}');
        expect(parsed['t-success']).toBeDefined();
        expect(parsed['t-success'].ssh).toBe('success@example.com');
    });

    it('throws an error when addTarget fails', async () => {
        const { context, globalState } = createMockContext();
        globalState.update.mockRejectedValue(new Error('persist-fail'));
        const store = TargetStore.getInstance(context);
        const t = new Target(
            't-fail',
            'fail@example.com',
            yamlTargetDescription,
        );

        const addTargetOperation = store.addTarget(t);

        await expect(addTargetOperation).rejects.toThrow('persist-fail');
        const raw = context.globalState.get('targets') as string | undefined;
        expect(raw).toBeUndefined();
    });

    it('persists targets via setTarget and exposes them via getTargets', async () => {
        const { context } = createMockContext();
        const store = TargetStore.getInstance(context);

        const t = new Target('t1', 'alice@example.com', yamlTargetDescription);
        await store.addTarget(t);

        const targets = store.getTargets();
        expect(targets.some((x) => x.id === 't1')).toBe(true);

        const raw = context.globalState.get('targets') as string | undefined;
        expect(typeof raw).toBe('string');
        const parsed = JSON.parse(raw || '{}');
        expect(parsed.t1).toBeDefined();
        expect(parsed.t1.ssh).toBe('alice@example.com');
    });

    it('stores selected target and fires onChanged when setSelected is called', async () => {
        const { context } = createMockContext();
        const store = TargetStore.getInstance(context);
        const t = new Target('t2', 'bob@example.com', yamlTargetDescription);
        await store.addTarget(t);
        const cb = jest.fn();
        store.onChanged(cb);

        await store.setSelected('t2');

        expect(context.workspaceState.get('selectedTarget')).toBe('t2');
        expect(cb).toHaveBeenCalled();
    });

    it('returns the selected Target via getSelectedTarget', async () => {
        const { context } = createMockContext();
        const store = TargetStore.getInstance(context);

        const t = new Target('t3', 'carol@example.com', yamlTargetDescription);
        await store.addTarget(t);
        await store.setSelected('t3');

        const selected = await store.getSelectedTarget();
        expect(selected).toBeDefined();
        expect(selected?.id).toBe('t3');
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
        await store.addTarget(
            new Target('td', 'd@example.com', yamlTargetDescription),
        );
        const cb = jest.fn();
        store.onChanged(cb);

        store.dispose();

        const newStore = TargetStore.getInstance(context);
        expect(newStore).not.toBe(store);
    });

    it('removes a non-selected target without changing selection', async () => {
        const { context } = createMockContext();
        const store = TargetStore.getInstance(context);
        const t1 = new Target('t-a', 'a@example.com', yamlTargetDescription);
        const t2 = new Target('t-b', 'b@example.com', yamlTargetDescription);
        await store.addTarget(t1);
        await store.addTarget(t2);
        await store.setSelected('t-a');

        await store.deleteTarget('t-b');

        const targets = store.getTargets();
        expect(targets.some((t) => t.id === 't-b')).toBe(false);
        const selected = await store.getSelectedTarget();
        expect(selected).toBeDefined();
        expect(selected?.id).toBe('t-a');
    });

    it('removes the selected target and falls back to the first remaining target', async () => {
        const { context } = createMockContext();
        const store = TargetStore.getInstance(context);
        const t1 = new Target('t-1', 'one@example.com', yamlTargetDescription);
        const t2 = new Target('t-2', 'two@example.com', yamlTargetDescription);
        const t3 = new Target(
            't-3',
            'three@example.com',
            yamlTargetDescription,
        );
        await store.addTarget(t1);
        await store.addTarget(t2);
        await store.addTarget(t3);
        await store.setSelected('t-2');

        await store.deleteTarget('t-2');

        const targets = store.getTargets();
        expect(targets.some((t) => t.id === 't-2')).toBe(false);
        const selected = await store.getSelectedTarget();
        expect(selected).toBeDefined();
        expect(selected?.id).toBe('t-1');
    });

    it('removes the only selected target and clears selection when none remain', async () => {
        const { context } = createMockContext();
        const store = TargetStore.getInstance(context);
        const lone = new Target(
            'only',
            'only@example.com',
            yamlTargetDescription,
        );
        await store.addTarget(lone);
        await store.setSelected('only');

        await store.deleteTarget('only');

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
