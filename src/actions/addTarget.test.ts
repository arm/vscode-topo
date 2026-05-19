import * as vscode from 'vscode';
import { mock } from 'jest-mock-extended';
import { AddTarget, buildQuickPickItems } from './addTarget';
import { logger } from '../util/logger';
import { TargetStore } from '../target/targetStore';

jest.mock('../util/logger');

async function executeCommand(command: string, ...args: unknown[]) {
    const calls = jest.mocked(vscode.commands.registerCommand).mock.calls;
    const addCall = calls.find((c: unknown[]) => c[0] === command);
    const handler = addCall![1] as (...args: unknown[]) => Promise<void>;
    await handler(...args);
}

function mockQuickPick(selectedItem: vscode.QuickPickItem | undefined) {
    const onDidAcceptEmitter = new vscode.EventEmitter<void>();
    const onDidHideEmitter = new vscode.EventEmitter<void>();
    const onDidChangeValueEmitter = new vscode.EventEmitter<string>();
    const quickPick = mock<vscode.QuickPick<vscode.QuickPickItem>>({
        title: '',
        placeholder: '',
        items: [] as vscode.QuickPickItem[],
        selectedItems: selectedItem ? [selectedItem] : [],
        onDidAccept: onDidAcceptEmitter.event,
        onDidHide: onDidHideEmitter.event,
        onDidChangeValue: onDidChangeValueEmitter.event,
        show: jest.fn(() => {
            if (selectedItem) {
                onDidAcceptEmitter.fire();
            } else {
                onDidHideEmitter.fire();
            }
        }),
    });
    jest.mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPick);
    return quickPick;
}

describe('buildQuickPickItems', () => {
    it('returns hosts', () => {
        const items = buildQuickPickItems(['host-a', 'host-b'], '');

        expect(items).toEqual([{ label: 'host-a' }, { label: 'host-b' }]);
    });

    it('prepends a manual entry when filter does not match any host', () => {
        const items = buildQuickPickItems(['host-a'], 'root@10.0.0.1');

        expect(items[0]).toEqual({
            label: 'root@10.0.0.1',
            description: 'Add new SSH target',
        });
        expect(items[1]).toEqual({ label: 'host-a' });
    });

    it('does not prepend manual entry when filter matches a host (case-insensitive)', () => {
        const items = buildQuickPickItems(['Host-A'], 'host-a');

        expect(items[0]).toEqual({ label: 'Host-A' });
    });

    it('does not prepend manual entry when filter is whitespace-only', () => {
        const items = buildQuickPickItems(['host-a'], '   ');

        expect(items[0]).toEqual({ label: 'host-a' });
    });

    it('trims whitespace from the filter for the manual entry label', () => {
        const items = buildQuickPickItems([], '  my-host  ');

        expect(items[0]).toEqual({
            label: 'my-host',
            description: 'Add new SSH target',
        });
    });

    it('returns nothing when no hosts and empty filter', () => {
        const items = buildQuickPickItems([], '');

        expect(items).toEqual([]);
    });
});

describe('AddTarget', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('handles addTargetCommand: prompts for ssh, stores and selects new target', async () => {
        const targetSsh = 'root@192.0.2.1';
        const targetStore = mock<TargetStore>();
        const addTarget = new AddTarget(targetStore);
        addTarget.activate();
        mockQuickPick({ label: targetSsh });

        await executeCommand(AddTarget.addTargetCommand);

        expect(targetStore.addTarget).toHaveBeenCalledTimes(1);
        expect(targetStore.addTarget).toHaveBeenCalledWith(targetSsh);
        expect(targetStore.setSelected).toHaveBeenCalledWith(targetSsh);
    });

    it('does nothing when quick pick is dismissed', async () => {
        const targetStore = mock<TargetStore>();
        const addTarget = new AddTarget(targetStore);
        addTarget.activate();
        mockQuickPick(undefined);

        await executeCommand(AddTarget.addTargetCommand);

        expect(targetStore.addTarget).not.toHaveBeenCalled();
        expect(targetStore.setSelected).not.toHaveBeenCalled();
    });

    it('shows error when targetStore.addTarget fails', async () => {
        const targetStore = mock<TargetStore>();
        const addTarget = new AddTarget(targetStore);
        addTarget.activate();
        mockQuickPick({ label: 'root@192.0.2.1' });
        const error = new Error('boom');
        jest.mocked(targetStore.addTarget).mockRejectedValueOnce(error);

        await executeCommand(AddTarget.addTargetCommand);

        expect(targetStore.addTarget).toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Failed to add target'),
            error,
        );
        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            expect.stringContaining('Failed to add target'),
        );
        expect(targetStore.setSelected).not.toHaveBeenCalled();
    });
});
