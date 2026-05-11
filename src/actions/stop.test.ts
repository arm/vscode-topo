import path from 'node:path';
import os from 'node:os';
import * as vscode from 'vscode';
import { Stop } from './stop';
import { mock, MockProxy } from 'jest-mock-extended';
import { TargetStore } from '../target/targetStore';
import { executeTask } from '../util/executeTask';
import { WrappedError } from '../errors/wrappedError';

jest.mock('../util/logger');
jest.mock('../util/executeTask');

const executeTaskMock = jest.mocked(executeTask);

describe('Stop', () => {
    let stop: Stop;
    const composeFileUri = vscode.Uri.file(
        path.join(os.tmpdir(), 'compose.yaml'),
    );
    const composeFilePath = composeFileUri.fsPath;
    const target = 'topo.local';
    let targetStore: MockProxy<TargetStore>;
    let context: MockProxy<vscode.ExtensionContext>;
    let stopHandler: ((resource?: vscode.Uri) => Promise<void>) | undefined;
    let registerSpy: jest.SpyInstance;

    beforeEach(() => {
        context = mock<vscode.ExtensionContext>({ subscriptions: [] });
        targetStore = mock<TargetStore>();
        targetStore.getSelectedTarget.mockResolvedValue(target);
        executeTaskMock.mockReset();
        jest.mocked(vscode.window.showErrorMessage).mockClear();
        stop = new Stop(context, targetStore);
        registerSpy = jest
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
        jest.restoreAllMocks();
    });

    it('registers the stop command on activate', () => {
        stop.activate();

        expect(registerSpy).toHaveBeenCalledWith(
            Stop.stopCommand,
            expect.any(Function),
        );
        expect(context.subscriptions.length).toBeGreaterThan(0);
    });

    it('shows an error in the command handler with no target selected', async () => {
        targetStore.getSelectedTarget.mockResolvedValueOnce(undefined);
        stop.activate();

        const stopOperation = stopHandler!(composeFileUri);

        await expect(stopOperation).resolves.toBeUndefined();
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Error executing stop command. No target selected. Please select a target before stopping.',
        );
        expect(executeTaskMock).not.toHaveBeenCalled();
    });

    it('shows an error when target lookup fails with a TARGET error', async () => {
        targetStore.getSelectedTarget.mockRejectedValueOnce(
            new WrappedError('TARGET', 'target store failed'),
        );
        stop.activate();
        jest.mocked(vscode.window.showErrorMessage).mockClear();

        const stopOperation = stopHandler!(composeFileUri);

        await expect(stopOperation).resolves.toBeUndefined();
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Error executing stop command. target store failed',
        );
        expect(executeTaskMock).not.toHaveBeenCalled();
    });

    it('rethrows non-TARGET target lookup errors in the command handler', async () => {
        targetStore.getSelectedTarget.mockRejectedValueOnce(
            new Error('target store failed'),
        );
        stop.activate();

        const stopOperation = stopHandler!(composeFileUri);

        await expect(stopOperation).rejects.toThrow('target store failed');
        expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
        expect(executeTaskMock).not.toHaveBeenCalled();
    });

    it('handles successful stop operation', async () => {
        await stop.stop(composeFilePath, target);

        expect(executeTaskMock).toHaveBeenCalledWith(
            'Stop services on topo.local',
            ['topo', 'stop', '--target', 'topo.local'],
            { cwd: path.dirname(composeFilePath) },
        );
    });

    it('handles task failure', async () => {
        executeTaskMock.mockRejectedValueOnce(new Error('stop failed'));
        await stop.stop(composeFilePath, target);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Stopping services on topo.local failed: stop failed',
        );
    });

    it('invokes handler when command called', async () => {
        stop.activate();

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
