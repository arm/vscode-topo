import * as vscode from 'vscode';
import { TargetStore } from './targetStore';
import { mutable } from '../util/mutable';
import { WrappedError } from '../errors/wrappedError';
import { mock, MockProxy } from 'vitest-mock-extended';

vi.mock('../util/logger');

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
    vi.mocked(vscode.workspace.createFileSystemWatcher).mockImplementation(
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
    vi.mocked(vscode.workspace.fs.writeFile).mockImplementation(
        async (uri, _content) => {
            for (const _entry of fsWatchers) {
                emitter.fire(uri);
            }
        },
    );

    beforeEach(() => {
        mutable(vscode.env).uiKind = vscode.UIKind.Desktop;
        mutable(vscode.window).state = {
            focused: true,
            active: true,
        };
        fsWatchers.length = 0;
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('saves targets and exposes them via loadTargets', async () => {
        mutable(vscode.env).uiKind = vscode.UIKind.Web;
        const { context } = createMockContext();
        const store = new TargetStore(context);
        const t = 'success@example.com';

        await store.saveTargets(new Set([t]));

        const targets = store.loadTargets();
        expect(targets.has(t)).toBe(true);
        const raw = context.globalState.get('targets') as string | undefined;
        expect(typeof raw).toBe('string');
        const parsed = JSON.parse(raw || '{}');
        expect(parsed[t]).toEqual({});
    });

    it('throws an error when saveTargets fails', async () => {
        const { context, globalState } = createMockContext();
        globalState.update.mockRejectedValue(new Error('persist-fail'));
        const store = new TargetStore(context);
        const t = 'fail@example.com';

        const saveTargetsOperation = store.saveTargets(new Set([t]));

        await expect(saveTargetsOperation).rejects.toThrow('persist-fail');
        const raw = context.globalState.get('targets') as string | undefined;
        expect(raw).toBeUndefined();
    });

    it('loads an empty target set when no targets have been saved', () => {
        const { context } = createMockContext();
        const store = new TargetStore(context);

        const targets = store.loadTargets();

        expect(targets).toEqual(new Set());
    });

    it('stores selected target and exposes it via loadSelected', async () => {
        const { context } = createMockContext();
        const store = new TargetStore(context);

        await store.saveSelected('bob@example.com');

        expect(context.workspaceState.get('selectedTarget')).toBe(
            'bob@example.com',
        );
        expect(store.loadSelected()).toBe('bob@example.com');
    });

    it('clears the selected target when saveSelected is given undefined', async () => {
        const { context } = createMockContext();
        const store = new TargetStore(context);
        await store.saveSelected('bob@example.com');

        await store.saveSelected(undefined);

        expect(context.workspaceState.get('selectedTarget')).toBeUndefined();
        expect(store.loadSelected()).toBeUndefined();
    });

    it('throws a STORAGE WrappedError when stored targets are malformed JSON', () => {
        const { context, globalState } = createMockContext();
        globalState.get.mockImplementation((key: string) =>
            key === 'targets' ? 'not-json' : undefined,
        );
        const store = new TargetStore(context);

        let thrown: unknown;
        try {
            store.loadTargets();
        } catch (err) {
            thrown = err;
        }
        expect(thrown).toBeInstanceOf(WrappedError);
        expect((thrown as WrappedError).code).toBe('STORAGE');
        expect((thrown as WrappedError).message).toBe('Failed to load targets');
        expect((thrown as WrappedError).logs).toEqual([
            {
                level: 'Error',
                msg: expect.stringContaining('Unexpected token'),
            },
        ]);
    });

    it('throws a STORAGE WrappedError when stored targets fail schema validation', () => {
        const { context, globalState } = createMockContext();
        globalState.get.mockImplementation((key: string) =>
            key === 'targets'
                ? JSON.stringify({ 'target@example.com': 'not-object' })
                : undefined,
        );
        const store = new TargetStore(context);

        let thrown: unknown;
        try {
            store.loadTargets();
        } catch (err) {
            thrown = err;
        }
        expect(thrown).toBeInstanceOf(WrappedError);
        expect((thrown as WrappedError).code).toBe('STORAGE');
        expect((thrown as WrappedError).message).toBe('Failed to load targets');
    });

    it('does not wrap errors when reading stored targets fails', () => {
        const { context, globalState } = createMockContext();
        const error = new Error('read failed');
        globalState.get.mockImplementation((key: string) => {
            if (key === 'targets') {
                throw error;
            }
            return undefined;
        });
        const store = new TargetStore(context);

        expect(() => store.loadTargets()).toThrow(error);
        expect(() => store.loadTargets()).not.toThrow(WrappedError);
    });

    it('fires onGlobalWrite when signal file is modified externally and window is not focused', async () => {
        const { context } = createMockContext();
        const store = new TargetStore(context);
        const cb = vi.fn();
        store.onGlobalWrite(cb);
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

    it('does not fire onGlobalWrite when signal file is modified while focused', async () => {
        const { context } = createMockContext();
        const store = new TargetStore(context);
        const cb = vi.fn();
        store.onGlobalWrite(cb);
        const signalUri = vscode.Uri.joinPath(
            context.globalStorageUri,
            'targets-update.signal',
        );

        await vscode.workspace.fs.writeFile(
            signalUri,
            new TextEncoder().encode('1'),
        );
        await waitImmediate();

        expect(cb).not.toHaveBeenCalled();
    });

    it('publishes one debounced signal after targets are saved on desktop', async () => {
        vi.useFakeTimers();
        const { context } = createMockContext();
        const store = new TargetStore(context);

        await store.saveTargets(new Set(['root@192.0.2.1']));
        await store.saveTargets(new Set(['root@192.0.2.2']));
        await vi.advanceTimersByTimeAsync(500);

        expect(vscode.workspace.fs.writeFile).toHaveBeenCalledTimes(1);
        expect(vscode.workspace.fs.writeFile).toHaveBeenCalledWith(
            vscode.Uri.joinPath(
                context.globalStorageUri,
                'targets-update.signal',
            ),
            expect.any(Uint8Array),
        );
    });

    it('does not publish a signal after targets are saved outside desktop', async () => {
        vi.useFakeTimers();
        mutable(vscode.env).uiKind = vscode.UIKind.Web;
        const { context } = createMockContext();
        const store = new TargetStore(context);

        await store.saveTargets(new Set(['root@192.0.2.1']));
        await vi.runAllTimersAsync();

        expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
    });

    it('deactivates the store, disposing resources', () => {
        const eventWithDisposable = (
            dispose: () => void,
        ): vscode.Event<vscode.Uri> => vi.fn(() => ({ dispose }));
        const watcherDispose = vi.fn();
        const onDidCreateDispose = vi.fn();
        const onDidChangeDispose = vi.fn();
        const watcher: vscode.FileSystemWatcher = {
            onDidCreate: eventWithDisposable(onDidCreateDispose),
            onDidChange: eventWithDisposable(onDidChangeDispose),
            onDidDelete: eventWithDisposable(vi.fn()),
            dispose: watcherDispose,
            ignoreCreateEvents: false,
            ignoreChangeEvents: false,
            ignoreDeleteEvents: false,
        };
        vi.mocked(vscode.workspace.createFileSystemWatcher).mockReturnValueOnce(
            watcher,
        );
        const { context } = createMockContext();
        const store = new TargetStore(context);

        store.dispose();

        expect(watcherDispose).toHaveBeenCalled();
        expect(onDidCreateDispose).toHaveBeenCalled();
        expect(onDidChangeDispose).toHaveBeenCalled();
    });

    it('cancels pending signal publication on dispose', async () => {
        vi.useFakeTimers();
        const { context } = createMockContext();
        const store = new TargetStore(context);

        await store.saveTargets(new Set(['root@192.0.2.1']));
        store.dispose();
        await vi.runAllTimersAsync();

        expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
    });
});
