import path from 'node:path';
import os from 'node:os';
import * as vscode from 'vscode';
import { Stop, stop as stopServices } from './stop';
import { mock, MockProxy } from 'vitest-mock-extended';
import { TargetStore } from '../target/targetStore';
import { executeTask } from '../util/executeTask';
import type { MockInstance } from 'vitest';

vi.mock('../util/logger');
vi.mock('../util/executeTask');

const executeTaskMock = vi.mocked(executeTask);

describe('Stop', () => {
    let stopAction: Stop;
    const composeFileUri = vscode.Uri.file(
        path.join(os.tmpdir(), 'compose.yaml'),
    );
    const composeFilePath = composeFileUri.fsPath;
    const target = 'topo.local';
    let targetStore: MockProxy<TargetStore>;
    let context: MockProxy<vscode.ExtensionContext>;
    let stopHandler: ((resource?: vscode.Uri) => Promise<void>) | undefined;
    let registerSpy: MockInstance;

    beforeEach(() => {
        context = mock<vscode.ExtensionContext>({ subscriptions: [] });
        targetStore = mock<TargetStore>();
        targetStore.getSelectedTarget.mockReturnValue(target);
        executeTaskMock.mockReset();
        vi.mocked(vscode.window.showErrorMessage).mockClear();
        stopAction = new Stop(context, targetStore);
        registerSpy = vi
            .spyOn(vscode.commands, 'registerCommand')
            .mockImplementation(
                (_, handler: (...args: unknown[]) => Promise<void>) => {
                    stopHandler = handler;
                    return { dispose: () => {} } as vscode.Disposable;
                },
            );
    });

    afterEach(() => {
        stopHandler = undefined;
        vi.restoreAllMocks();
    });

    it('registers the stop command on activate', () => {
        stopAction.activate();

        expect(registerSpy).toHaveBeenCalledWith(
            Stop.stopCommand,
            expect.any(Function),
        );
        expect(context.subscriptions.length).toBeGreaterThan(0);
    });

    it('shows an error in the command handler with no target selected', async () => {
        targetStore.getSelectedTarget.mockReturnValueOnce(undefined);
        stopAction.activate();

        const stopOperation = stopHandler!(composeFileUri);

        await expect(stopOperation).resolves.toBeUndefined();
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Error executing stop command. No target selected. Please select a target before stopping.',
        );
        expect(executeTaskMock).not.toHaveBeenCalled();
    });

    it('rethrows target lookup errors in the command handler', async () => {
        targetStore.getSelectedTarget.mockImplementationOnce(() => {
            throw new Error('target store failed');
        });
        stopAction.activate();

        const stopOperation = stopHandler!(composeFileUri);

        await expect(stopOperation).rejects.toThrow('target store failed');
        expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
        expect(executeTaskMock).not.toHaveBeenCalled();
    });

    it('handles successful stop operation', async () => {
        await stopServices(composeFilePath, target);

        expect(executeTaskMock).toHaveBeenCalledWith(
            'Stop services on topo.local',
            ['topo', 'stop', '--target', 'topo.local'],
            { cwd: path.dirname(composeFilePath) },
        );
    });

    it('handles task failure', async () => {
        executeTaskMock.mockRejectedValueOnce(new Error('stop failed'));
        await stopServices(composeFilePath, target);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Stopping services on topo.local failed: stop failed',
        );
    });

    it('invokes handler when command called', async () => {
        stopAction.activate();

        const op = stopHandler!(composeFileUri);

        await expect(op).resolves.toBeUndefined();
        expect(targetStore.getSelectedTarget).toHaveBeenCalled();
        expect(executeTaskMock).toHaveBeenCalledWith(
            'Stop services on topo.local',
            ['topo', 'stop', '--target', 'topo.local'],
            { cwd: path.dirname(composeFilePath) },
        );
    });
});
