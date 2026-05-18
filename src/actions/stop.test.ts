import path from 'node:path';
import os from 'node:os';
import * as vscode from 'vscode';
import { Stop } from './stop';
import { mock, MockProxy } from 'jest-mock-extended';
import { TargetStore } from '../target/targetStore';
import { executeTask } from '../util/executeTask';
import { refreshTargetContainersCommand } from '../refreshCommands';

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

    it('fails with no target selected', async () => {
        targetStore.getSelectedTarget.mockResolvedValueOnce(undefined);

        const stopOperation = stop.stop(composeFilePath);

        await expect(stopOperation).rejects.toThrow('No target selected');
    });

    it('handles successful stop operation', async () => {
        await stop.stop(composeFilePath);

        expect(executeTaskMock).toHaveBeenCalledWith(
            'Stop services on topo.local',
            ['topo', 'stop', '--target', 'topo.local'],
            { cwd: path.dirname(composeFilePath) },
        );
    });

    it('refreshes target containers after stopping services', async () => {
        await stop.stop(composeFilePath);

        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            refreshTargetContainersCommand,
        );
    });

    it('handles task failure', async () => {
        executeTaskMock.mockRejectedValueOnce(new Error('stop failed'));
        await stop.stop(composeFilePath);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Stopping services on topo.local failed: stop failed',
        );
    });

    it('refreshes target containers when stop fails', async () => {
        executeTaskMock.mockRejectedValueOnce(new Error('stop failed'));

        await stop.stop(composeFilePath);

        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            refreshTargetContainersCommand,
        );
    });

    it('invokes handler when command called', async () => {
        stop.activate();

        const op = stopHandler!(composeFileUri);

        await expect(op).resolves.toBeUndefined();
        expect(executeTaskMock).toHaveBeenCalledWith(
            'Stop services on topo.local',
            ['topo', 'stop', '--target', 'topo.local'],
            { cwd: path.dirname(composeFilePath) },
        );
    });
});
