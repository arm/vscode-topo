import * as vscode from 'vscode';
import fs from 'fs';
import path from 'path';
import { TargetStore } from './targetStore';
import { Target } from './target';
import { mutable } from '../util/mutable';
import { mock, MockProxy } from 'jest-mock-extended';
import { targetDescriptionFileName, TopoCli } from '../topoCli';
import { Deferred } from '../util/deferred';
import { TargetDescription } from '../util/types';

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

const createTargetDescriptionYaml = (
    model: string,
    remoteprocCPUName: string,
) => `host:
    - model: ${model}
      cores: 2
      features:
        - fp
remoteprocs:
    - name: ${remoteprocCPUName}`;

function writeTargetDescription(outputDirectory: string, yaml: string): string {
    const descriptionPath = path.join(
        outputDirectory,
        targetDescriptionFileName,
    );
    fs.writeFileSync(descriptionPath, yaml);
    return descriptionPath;
}

function createMockContext(): {
    context: vscode.ExtensionContext;
    globalState: MockProxy<vscode.Memento>;
    workspaceState: MockProxy<vscode.Memento>;
    topoCli: MockProxy<TopoCli>;
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
    const topoCli = mock<TopoCli>();
    topoCli.describe.mockImplementation(async (outputDirectory: string) =>
        writeTargetDescription(outputDirectory, yamlTargetDescription),
    );

    return { context, globalState, workspaceState, topoCli };
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
        const { context, topoCli } = createMockContext();
        const store = TargetStore.getInstance(context, topoCli);
        const t = new Target('t-success', 'success@example.com');

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
        const { context, globalState, topoCli } = createMockContext();
        globalState.update.mockRejectedValue(new Error('persist-fail'));
        const store = TargetStore.getInstance(context, topoCli);
        const t = new Target('t-fail', 'fail@example.com');

        const addTargetOperation = store.addTarget(t);

        await expect(addTargetOperation).rejects.toThrow('persist-fail');
        const raw = context.globalState.get('targets') as string | undefined;
        expect(raw).toBeUndefined();
    });

    it('persists targets via setTarget and exposes them via getTargets', async () => {
        const { context, topoCli } = createMockContext();
        const store = TargetStore.getInstance(context, topoCli);

        const t = new Target('t1', 'alice@example.com');
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
        const { context, topoCli } = createMockContext();
        const store = TargetStore.getInstance(context, topoCli);
        const t = new Target('t2', 'bob@example.com');
        await store.addTarget(t);
        const cb = jest.fn();
        store.onChanged(cb);

        await store.setSelected('t2');

        expect(context.workspaceState.get('selectedTarget')).toBe('t2');
        expect(cb).toHaveBeenCalled();
    });

    it('returns the selected Target via getSelectedTarget', async () => {
        const { context, topoCli } = createMockContext();
        const store = TargetStore.getInstance(context, topoCli);

        const t = new Target('t3', 'carol@example.com');
        await store.addTarget(t);
        await store.setSelected('t3');

        const selected = await store.getSelectedTarget();
        expect(selected).toBeDefined();
        expect(selected?.id).toBe('t3');
        expect(selected?.ssh).toBe('carol@example.com');
    });

    it('fires onChanged when signal file is modified externally and window is not focused', async () => {
        const { context, topoCli } = createMockContext();
        const store = TargetStore.getInstance(context, topoCli);
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
        const { context, topoCli } = createMockContext();
        const store = TargetStore.getInstance(context, topoCli);
        await store.addTarget(new Target('td', 'd@example.com'));
        const cb = jest.fn();
        store.onChanged(cb);

        store.dispose();

        const newStore = TargetStore.getInstance(context, topoCli);
        expect(newStore).not.toBe(store);
    });

    it('removes a non-selected target without changing selection', async () => {
        const { context, topoCli } = createMockContext();
        const store = TargetStore.getInstance(context, topoCli);
        const t1 = new Target('t-a', 'a@example.com');
        const t2 = new Target('t-b', 'b@example.com');
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
        const { context, topoCli } = createMockContext();
        const store = TargetStore.getInstance(context, topoCli);
        const t1 = new Target('t-1', 'one@example.com');
        const t2 = new Target('t-2', 'two@example.com');
        const t3 = new Target('t-3', 'three@example.com');
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
        const { context, topoCli } = createMockContext();
        const store = TargetStore.getInstance(context, topoCli);
        const lone = new Target('only', 'only@example.com');
        await store.addTarget(lone);
        await store.setSelected('only');

        await store.deleteTarget('only');

        const targets = store.getTargets();
        expect(targets.length).toBe(0);
        const selected = await store.getSelectedTarget();
        expect(selected).toBeUndefined();
    });

    it('throws when deleting a non-existent target id', async () => {
        const { context, topoCli } = createMockContext();
        const store = TargetStore.getInstance(context, topoCli);

        const deleteTargetOperation = store.deleteTarget('no-such-id');

        await expect(deleteTargetOperation).rejects.toThrow('does not exist');
    });

    it('generates a target description when requested and caches it', async () => {
        const { context, topoCli } = createMockContext();
        const store = TargetStore.getInstance(context, topoCli);
        const t = new Target('desc-target', 'desc@example.com');
        await store.addTarget(t);
        await store.setSelected(t.id);

        await store.getSelectedTargetDescription();

        expect(topoCli.describe).toHaveBeenCalledTimes(1);
        expect(topoCli.describe).toHaveBeenCalledWith(
            expect.any(String),
            t.ssh,
        );
    });

    it('only calls describe once for the same target', async () => {
        const { context, topoCli } = createMockContext();
        const store = TargetStore.getInstance(context, topoCli);
        const t = new Target('desc-target', 'desc@example.com');
        await store.addTarget(t);
        await store.setSelected(t.id);

        await store.getSelectedTargetDescription();
        await store.getSelectedTargetDescription();
        await store.getSelectedTargetDescription();

        expect(topoCli.describe).toHaveBeenCalledTimes(1);
    });

    it('keeps the newer selected target description when an older describe resolves later', async () => {
        const { context, topoCli } = createMockContext();
        const store = TargetStore.getInstance(context, topoCli);
        const slowTarget = new Target('slow-target', 'slow@example.com');
        const freshTarget = new Target('fresh-target', 'fresh@example.com');
        const releaseSlowDescribe = new Deferred<void>();
        const slowDescribeFinished = new Deferred<void>();
        const freshDescription: TargetDescription = {
            hostProcessor: [
                { model: 'Cortex-A78', cores: 2, features: ['fp'] },
            ],
            remoteprocCPU: [{ name: 'fresh-rproc' }],
        };
        const slowDescription: TargetDescription = {
            hostProcessor: [
                { model: 'Cortex-A55', cores: 2, features: ['fp'] },
            ],
            remoteprocCPU: [{ name: 'stale-rproc' }],
        };

        topoCli.describe.mockImplementation(async (outputDirectory, ssh) => {
            if (ssh === slowTarget.ssh) {
                await releaseSlowDescribe.promise;
                slowDescribeFinished.resolve();
                return writeTargetDescription(
                    outputDirectory,
                    createTargetDescriptionYaml('Cortex-A55', 'stale-rproc'),
                );
            }

            return writeTargetDescription(
                outputDirectory,
                createTargetDescriptionYaml('Cortex-A78', 'fresh-rproc'),
            );
        });

        await store.addTarget(slowTarget);
        await store.addTarget(freshTarget);
        await store.setSelected(slowTarget.id);

        const staleDescriptionPromise = store.getSelectedTargetDescription();
        await waitImmediate();

        await store.setSelected(freshTarget.id);
        await expect(store.getSelectedTargetDescription()).resolves.toEqual(
            freshDescription,
        );

        releaseSlowDescribe.resolve();
        await slowDescribeFinished.promise;
        await waitImmediate();

        await expect(staleDescriptionPromise).resolves.toEqual(slowDescription);
        await expect(store.getSelectedTargetDescription()).resolves.toEqual(
            freshDescription,
        );
        expect(topoCli.describe).toHaveBeenCalledTimes(2);
    });
});
