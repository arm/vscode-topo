import * as vscode from 'vscode';
import { TargetStore } from './targetStore';
import { mutable } from '../util/mutable';
import { mock, MockProxy } from 'jest-mock-extended';

jest.mock('../util/logger');

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
    beforeEach(() => {
        mutable(vscode.window).state = {
            focused: true,
            active: true,
        };
        jest.clearAllMocks();
    });

    it('adds a target successfully and persists it', async () => {
        const { context } = createMockContext();
        const store = new TargetStore(context);
        const t = 'success@example.com';

        const addTargetOperation = store.addTarget(t);

        await expect(addTargetOperation).resolves.toBeUndefined();
        const targets = store.getTargets();
        expect(targets.some((x) => x === t)).toBe(true);
        const raw = context.globalState.get('targets') as string | undefined;
        expect(typeof raw).toBe('string');
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

    it('persists targets via setTarget and exposes them via getTargets', async () => {
        const { context } = createMockContext();
        const store = new TargetStore(context);

        const t = 'alice@example.com';
        await store.addTarget(t);

        const targets = store.getTargets();
        expect(targets.some((x) => x === t)).toBe(true);

        const raw = context.globalState.get('targets') as string | undefined;
        expect(typeof raw).toBe('string');
        const parsed = JSON.parse(raw || '{}');
        expect(parsed[t]).toEqual({});
    });

    it('stores selected target and fires onSelectedTargetChanged when setSelected is called', async () => {
        const { context } = createMockContext();
        const store = new TargetStore(context);
        const t = 'bob@example.com';
        await store.addTarget(t);
        const cb = jest.fn();
        store.onSelectedTargetChanged(cb);

        await store.setSelected('bob@example.com');

        expect(context.workspaceState.get('selectedTarget')).toBe(
            'bob@example.com',
        );
        expect(cb).toHaveBeenCalled();
    });

    it('returns the selected Target via getSelectedTarget', async () => {
        const { context } = createMockContext();
        const store = new TargetStore(context);

        const t = 'carol@example.com';
        await store.addTarget(t);
        await store.setSelected('carol@example.com');

        const selected = await store.getSelectedTarget();
        expect(selected).toBeDefined();
        expect(selected).toBe('carol@example.com');
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
        expect(targets.some((t) => t === t2)).toBe(false);
        const selected = await store.getSelectedTarget();
        expect(selected).toBeDefined();
    });

    it('removes the selected target and falls back to the first remaining target', async () => {
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
        expect(targets.some((t) => t === t2)).toBe(false);
        const selected = await store.getSelectedTarget();
        expect(selected).toBeDefined();
        expect(selected).toBe(t1);
    });

    it('removes the only selected target and clears selection when none remain', async () => {
        const { context } = createMockContext();
        const store = new TargetStore(context);
        const lone = 'only@example.com';
        await store.addTarget(lone);
        await store.setSelected(lone);

        await store.deleteTarget(lone);

        const targets = store.getTargets();
        expect(targets.length).toBe(0);
        const selected = await store.getSelectedTarget();
        expect(selected).toBeUndefined();
    });

    it('throws when deleting a non-existent target id', async () => {
        const { context } = createMockContext();
        const store = new TargetStore(context);

        const deleteTargetOperation = store.deleteTarget('no-such-id');

        await expect(deleteTargetOperation).rejects.toThrow('does not exist');
    });
});
