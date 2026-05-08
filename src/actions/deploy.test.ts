import path from 'node:path';
import os from 'node:os';
import * as vscode from 'vscode';
import { Deploy } from './deploy';
import { mock, MockProxy } from 'jest-mock-extended';
import { TargetStore } from '../workloadPlacement/targetStore';
import { executeTask } from '../util/executeTask';

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
        targetStore.getSelectedTarget.mockReturnValue(target);
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

    it('fails with no target selected', async () => {
        targetStore.getSelectedTarget.mockReturnValueOnce(undefined);

        const deployOperation = deploy.deploy(composeFilePath);

        await expect(deployOperation).rejects.toThrow('No target selected');
    });

    it('handles successful deploy operation', async () => {
        await deploy.deploy(composeFilePath);

        expect(executeTaskMock).toHaveBeenCalledWith(
            'Deploy to topo.local',
            ['topo', 'deploy', '--target', 'topo.local'],
            { cwd: path.dirname(composeFilePath) },
        );
    });

    it('handles task failure', async () => {
        executeTaskMock.mockRejectedValueOnce(new Error('deploy failed'));
        await deploy.deploy(composeFilePath);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Deployment to topo.local failed: deploy failed',
        );
    });

    it('invokes handler when command called', async () => {
        deploy.activate();

        const op = deployHandler!(composeFileUri);

        await expect(op).resolves.toBeUndefined();
        expect(executeTaskMock).toHaveBeenCalledWith(
            'Deploy to topo.local',
            ['topo', 'deploy', '--target', 'topo.local'],
            { cwd: path.dirname(composeFilePath) },
        );
    });
});
