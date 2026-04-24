import path from 'node:path';
import os from 'node:os';
import * as vscode from 'vscode';
import { Deploy } from './deploy';
import { mock, MockProxy } from 'jest-mock-extended';
import { TargetStore } from '../workloadPlacement/targetStore';
import { TargetDestination } from '../util/types';
import { mutable } from '../util/mutable';

jest.mock('../util/logger');

const waitImmediate = () =>
    new Promise<void>((resolve) => setTimeout(() => resolve(), 0));

describe('Deploy', () => {
    let deploy: Deploy;
    const composeFileUri = vscode.Uri.file(
        path.join(os.tmpdir(), 'compose.yaml'),
    );
    const composeFilePath = composeFileUri.fsPath;
    const deployTask: vscode.Task = expect.objectContaining({
        execution: expect.objectContaining({
            executablePath: 'topo',
            executionArgs: expect.arrayContaining([
                'deploy',
                '--target',
                'topo.local',
            ]),
            options: {
                cwd: path.dirname(composeFilePath),
            },
        }),
    });
    const target = 'topo.local' as TargetDestination;
    let targetStore: MockProxy<TargetStore>;
    let context: MockProxy<vscode.ExtensionContext>;
    let deployHandler: ((resource?: vscode.Uri) => Promise<void>) | undefined;
    let registerSpy: jest.SpyInstance;
    const taskExec: vscode.TaskExecution = {
        task: {} as vscode.Task,
        terminate: jest.fn(),
    };

    beforeEach(() => {
        context = mock<vscode.ExtensionContext>({ subscriptions: [] });
        targetStore = mock<TargetStore>();
        targetStore.getSelectedTarget.mockResolvedValue(target);
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
        targetStore.getSelectedTarget.mockResolvedValueOnce(undefined);

        const deployOperation = deploy.deploy(composeFilePath);

        await expect(deployOperation).rejects.toThrow('No target selected');
    });

    it('handles successful deploy operation', async () => {
        deploy.deploy(composeFilePath);
        await waitImmediate();

        expect(jest.mocked(vscode.tasks.executeTask)).toHaveBeenCalledWith(
            deployTask,
        );
    });

    it('handles task failure', async () => {
        const onDidEndTaskProcessEmitter =
            new vscode.EventEmitter<vscode.TaskProcessEndEvent>();
        mutable(vscode.tasks).onDidEndTaskProcess =
            onDidEndTaskProcessEmitter.event;
        jest.mocked(vscode.tasks.executeTask).mockResolvedValueOnce(taskExec);

        await deploy.deploy(composeFilePath);
        onDidEndTaskProcessEmitter.fire({
            execution: taskExec,
            exitCode: 1,
        });
        await waitImmediate();

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Deployment to topo.local failed with exit code 1.',
        );
    });

    it('invokes handler when command called', async () => {
        deploy.activate();

        const op = deployHandler!(composeFileUri);
        await waitImmediate();

        await expect(op).resolves.toBeUndefined();
        expect(jest.mocked(vscode.tasks.executeTask)).toHaveBeenCalledWith(
            deployTask,
        );
    });
});
