import * as vscode from 'vscode';
import { TargetStore } from './targetStore';
import { mutable } from '../util/test/mutable';
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
    globalState.keys.mockImplementation(() => [...globalMap.keys()]);
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
            if (value === undefined) {
                globalMap.delete(key);
                return;
            }
            globalMap.set(key, value);
        },
    );

    const workspaceState = mock<vscode.ExtensionContext['workspaceState']>();
    workspaceState.keys.mockImplementation(() => [...workspaceMap.keys()]);
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
            if (value === undefined) {
                workspaceMap.delete(key);
                return;
            }
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
        mutable(vscode.window).state = {
            focused: true,
            active: true,
        };
        vi.clearAllMocks();
    });

    it('adds a target successfully and persists it', async () => {
        const { context } = createMockContext();
        const store = new TargetStore(context);
        const t = 'success@example.com';

        const addTargetOperation = store.addTarget(t);

        await expect(addTargetOperation).resolves.toBeUndefined();
        const targets = store.getTargets();
        expect(targets).toContain(t);
        const raw = context.globalState.get('targets') as string | undefined;
        expect(raw).toBeTypeOf('string');
        const parsed = JSON.parse(raw || '{}');
        expect(parsed[t]).toEqual({});
    });

    it('throws an error when addTarget fails', async () => {
        const { context, globalState } = createMockContext();
        globalState.update.mockRejectedValue(new Error('persist-fail'));
        const store = new TargetStore(context);
        const t = 'fail@example.com';

        const addTargetOperation = store.addTarget(t);

        await expect(addTargetOperation).rejects.toThrow('persist-fail');
        const raw = context.globalState.get('targets') as string | undefined;
        expect(raw).toBeUndefined();
    });

    it.each([
        '-oProxyCommand=touch /tmp/pwned',
        'user@example.com another',
        ' user@example.com',
        'user@example.com ',
        'user@example.com\nother',
    ])('rejects invalid target "%s"', async (target) => {
        const { context } = createMockContext();
        const store = new TargetStore(context);

        await expect(store.addTarget(target)).rejects.toMatchObject({
            code: 'INVALID_SSH_DESTINATION',
        });
        expect(context.globalState.get('targets')).toBeUndefined();
    });

    it('persists targets via setTarget and exposes them via getTargets', async () => {
        const { context } = createMockContext();
        const store = new TargetStore(context);

        const t = 'alice@example.com';
        await store.addTarget(t);

        const targets = store.getTargets();
        expect(targets).toContain(t);

        const raw = context.globalState.get('targets') as string | undefined;
        expect(raw).toBeTypeOf('string');
        const parsed = JSON.parse(raw || '{}');
        expect(parsed[t]).toEqual({});
    });

    it('stores selected target', async () => {
        const { context } = createMockContext();
        const store = new TargetStore(context);
        const t = 'bob@example.com';
        await store.addTarget(t);

        await store.setSelected('bob@example.com');

        expect(context.workspaceState.get('selectedTarget')).toBe(
            'bob@example.com',
        );
    });

    it('returns the selected Target via getSelectedTarget', async () => {
        const { context } = createMockContext();
        const store = new TargetStore(context);

        const t = 'carol@example.com';
        await store.addTarget(t);
        await store.setSelected('carol@example.com');

        const selected = store.getSelectedTarget();
        expect(selected).toBe('carol@example.com');
    });

    it('throws a STORAGE WrappedError when stored targets are malformed JSON', () => {
        const { context, globalState } = createMockContext();
        globalState.get.mockImplementation((key: string) =>
            key === 'targets' ? 'not-json' : undefined,
        );
        const store = new TargetStore(context);
        const expectedError = new WrappedError(
            'STORAGE',
            'Failed to parse stored targets',
            [
                {
                    level: 'Error',
                    msg: expect.stringContaining('Unexpected token'),
                },
            ],
        );

        expect(() => store.getTargets()).toThrow(expectedError);
    });

    it('throws a STORAGE WrappedError when stored targets fail schema validation', () => {
        const { context, globalState } = createMockContext();
        globalState.get.mockImplementation((key: string) =>
            key === 'targets'
                ? JSON.stringify({ 'target@example.com': 'not-object' })
                : undefined,
        );
        const store = new TargetStore(context);
        const expectedError = new WrappedError(
            'STORAGE',
            'Failed to parse stored targets',
            [
                {
                    level: 'Error',
                    msg: expect.stringContaining('Expected an object'),
                },
            ],
        );

        expect(() => store.getTargets()).toThrow(expectedError);
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

        expect(() => store.getTargets()).toThrow(error);
        expect(() => store.getTargets()).not.toThrow(WrappedError);
    });

    it('fires onChanged when signal file is modified externally and window is not focused', async () => {
        const { context } = createMockContext();
        const store = new TargetStore(context);
        const cb = vi.fn();
        store.onExternalTargetsChanged(cb);
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

    it('removes a non-selected target without changing selection', async () => {
        const { context } = createMockContext();
        const store = new TargetStore(context);
        const t1 = 'a@example.com';
        const t2 = 'b@example.com';
        await store.addTarget(t1);
        await store.addTarget(t2);
        await store.setSelected(t1);

        await store.deleteTarget(t2);

        const targets = store.getTargets();
        expect(targets).not.toContain(t2);
        const selected = store.getSelectedTarget();
        expect(selected).toBe(t1);
    });

    it('removes the selected target and clears selection even when targets remain', async () => {
        const { context } = createMockContext();
        const store = new TargetStore(context);
        const t1 = 'one@example.com';
        const t2 = 'two@example.com';
        const t3 = 'three@example.com';
        await store.addTarget(t1);
        await store.addTarget(t2);
        await store.addTarget(t3);
        await store.setSelected(t2);

        await store.deleteTarget(t2);

        const targets = store.getTargets();
        expect(targets).not.toContain(t2);
        const selected = store.getSelectedTarget();
        expect(selected).toBeUndefined();
    });

    it('removes the only selected target and clears selection when none remain', async () => {
        const { context } = createMockContext();
        const store = new TargetStore(context);
        const lone = 'only@example.com';
        await store.addTarget(lone);
        await store.setSelected(lone);

        await store.deleteTarget(lone);

        const targets = store.getTargets();
        expect(targets.size).toBe(0);
        const selected = store.getSelectedTarget();
        expect(selected).toBeUndefined();
    });

    it('throws when deleting a non-existent target id', async () => {
        const { context } = createMockContext();
        const store = new TargetStore(context);

        const deleteTargetOperation = store.deleteTarget('no-such-id');

        await expect(deleteTargetOperation).rejects.toThrow('does not exist');
    });

    it('resets extension data from global state, workspace state and global storage', async () => {
        const { context } = createMockContext();
        const store = new TargetStore(context);

        await store.addTarget('target@example.com');
        await store.setSelected('target@example.com');

        await store.resetExtensionData();

        expect(context.globalState.keys()).toEqual([]);
        expect(context.workspaceState.keys()).toEqual([]);
        expect(vscode.workspace.fs.delete).toHaveBeenCalledWith(
            context.globalStorageUri,
            { recursive: true, useTrash: false },
        );
        await vi.waitFor(() => {
            expect(vscode.workspace.fs.createDirectory).toHaveBeenCalledWith(
                context.globalStorageUri,
            );
            expect(vscode.workspace.fs.writeFile).toHaveBeenCalledWith(
                vscode.Uri.joinPath(
                    context.globalStorageUri,
                    'targets-update.signal',
                ),
                expect.any(Uint8Array),
            );
        });
    });

    it('does not fail when resetting extension data and global storage does not exist', async () => {
        const { context } = createMockContext();
        const store = new TargetStore(context);
        vi.mocked(vscode.workspace.fs.delete).mockRejectedValueOnce(
            vscode.FileSystemError.FileNotFound(context.globalStorageUri),
        );

        await expect(store.resetExtensionData()).resolves.toBeUndefined();
        await vi.waitFor(() => {
            expect(vscode.workspace.fs.createDirectory).toHaveBeenCalledWith(
                context.globalStorageUri,
            );
        });
    });
});
