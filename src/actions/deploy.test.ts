import path from 'node:path';
import os from 'node:os';
import * as vscode from 'vscode';
import { Deploy } from './deploy';
import { mock, MockProxy } from 'jest-mock-extended';
import { TargetStore } from '../target/targetStore';
import { executeTask } from '../util/executeTask';
import { WrappedError } from '../errors/wrappedError';

jest.mock('../util/logger');
jest.mock('../util/executeTask');

const executeTaskMock = jest.mocked(executeTask);

describe('Deploy', () => {
    let deploy: Deploy;
    const composeFileUri = vscode.Uri.file(
        path.join(os.tmpdir(), 'compose.yaml'),
    );
    const composeFilePath = composeFileUri.fsPath;
    const target = 'topo.local';
    let targetStore: MockProxy<TargetStore>;
    let context: MockProxy<vscode.ExtensionContext>;
    let deployHandler: ((resource?: vscode.Uri) => Promise<void>) | undefined;
    let registerSpy: jest.SpyInstance;

    beforeEach(() => {
        context = mock<vscode.ExtensionContext>({ subscriptions: [] });
        targetStore = mock<TargetStore>();
        targetStore.getSelectedTarget.mockResolvedValue(target);
        executeTaskMock.mockReset();
        jest.mocked(vscode.window.showErrorMessage).mockClear();
        deploy = new Deploy(context, targetStore);
        registerSpy = jest
            .spyOn(vscode.commands, 'registerCommand')
            .mockImplementation(
                (_, handler: (...args: unknown[]) => Promise<void>) => {
                    deployHandler = handler;
                    return { dispose: () => {} } as vscode.Disposable;
                },
            );
    });

    afterEach(() => {
        deployHandler = undefined;
        jest.restoreAllMocks();
    });

    it('registers the deploy command on activate', () => {
        deploy.activate();

        expect(registerSpy).toHaveBeenCalledWith(
            Deploy.deployCommand,
            expect.any(Function),
        );
        expect(context.subscriptions.length).toBeGreaterThan(0);
    });

    it('shows an error in the command handler with no target selected', async () => {
        targetStore.getSelectedTarget.mockResolvedValueOnce(undefined);
        deploy.activate();

        const deployOperation = deployHandler!(composeFileUri);

        await expect(deployOperation).resolves.toBeUndefined();
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Error executing deploy command. No target selected. Please select a target before deploying.',
        );
        expect(executeTaskMock).not.toHaveBeenCalled();
    });

    it('shows an error when target lookup fails with a TARGET error', async () => {
        targetStore.getSelectedTarget.mockRejectedValueOnce(
            new WrappedError('TARGET', 'target store failed'),
        );
        deploy.activate();
        jest.mocked(vscode.window.showErrorMessage).mockClear();

        const deployOperation = deployHandler!(composeFileUri);

        await expect(deployOperation).resolves.toBeUndefined();
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Error executing deploy command. target store failed',
        );
        expect(executeTaskMock).not.toHaveBeenCalled();
    });

    it('rethrows non-TARGET target lookup errors in the command handler', async () => {
        targetStore.getSelectedTarget.mockRejectedValueOnce(
            new Error('target store failed'),
        );
        deploy.activate();

        const deployOperation = deployHandler!(composeFileUri);

        await expect(deployOperation).rejects.toThrow('target store failed');
        expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
        expect(executeTaskMock).not.toHaveBeenCalled();
    });

    it('handles successful deploy operation', async () => {
        await deploy.deploy(composeFilePath, target);

        expect(executeTaskMock).toHaveBeenCalledWith(
            'Deploy to topo.local',
            ['topo', 'deploy', '--target', 'topo.local'],
            { cwd: path.dirname(composeFilePath) },
        );
    });

    it('handles task failure', async () => {
        executeTaskMock.mockRejectedValueOnce(new Error('deploy failed'));
        await deploy.deploy(composeFilePath, target);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Deployment to topo.local failed: deploy failed',
        );
    });

    it('invokes handler when command called', async () => {
        deploy.activate();

        const op = deployHandler!(composeFileUri);

        await expect(op).resolves.toBeUndefined();
        expect(targetStore.getSelectedTarget).toHaveBeenCalled();
        expect(executeTaskMock).toHaveBeenCalledWith(
            'Deploy to topo.local',
            ['topo', 'deploy', '--target', 'topo.local'],
            { cwd: path.dirname(composeFilePath) },
        );
    });
});
