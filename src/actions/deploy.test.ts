import path from 'path';
import os from 'os';
import * as vscode from 'vscode';
import { logger } from '../util/logger';
import { Deploy } from './deploy';
import { DeployerType } from './deploy';

jest.mock('vscode');
jest.mock('../util/logger');

const waitImmediate = () => new Promise<void>(resolve => setTimeout(() => resolve(), 0));

describe('Deploy', () => {
    let deploy: Deploy;
    const composeFileUri = vscode.Uri.file(path.join(os.tmpdir(), 'compose.yaml'));
    const composeFilePath = composeFileUri.fsPath;
    let deployer: DeployerType;
    let stdoutDataEmitter: vscode.EventEmitter<Buffer>;
    let stderrDataEmitter: vscode.EventEmitter<Buffer>;
    let exitEmitter: vscode.EventEmitter<number | null>;
    let errorEmitter: vscode.EventEmitter<Error>;
    let context: Pick<vscode.ExtensionContext, 'subscriptions'>;
    let deployHandler: ((resource?: vscode.Uri) => Promise<void>) | undefined;
    let registerSpy: jest.SpyInstance;

    beforeEach(() => {
        context = { subscriptions: [] };
        stderrDataEmitter = new vscode.EventEmitter<Buffer>();
        stdoutDataEmitter = new vscode.EventEmitter<Buffer>();
        exitEmitter = new vscode.EventEmitter<number | null>();
        errorEmitter = new vscode.EventEmitter<Error>();
        deployer = {
            start: jest.fn().mockImplementation(() => Promise.resolve()),
            stop: jest.fn(),
            onStdoutData: stdoutDataEmitter.event,
            onStderrData: stderrDataEmitter.event,
            onExit: exitEmitter.event,
            onError: errorEmitter.event,
        };
        deploy = new Deploy(context, deployer);
        (vscode.window.withProgress as jest.Mock).mockImplementation(async (_opts, cb) => {
            const token = {
                onCancellationRequested: (cb2: () => void) => cb2(),
            };
            await cb({}, token);
        });
        registerSpy = jest.spyOn(vscode.commands, 'registerCommand').mockImplementation((_, handler: (...args: unknown[]) => Promise<void>) => {
            deployHandler = handler;
            return { dispose: () => {} } as vscode.Disposable;
        });
    });

    afterEach(() => {
        deployHandler = undefined;
        jest.restoreAllMocks();
    });

    it('registers the deploy command on activate', () => {
        deploy.activate();

        expect(registerSpy).toHaveBeenCalledWith(Deploy.deployCommand, expect.any(Function));
        expect(context.subscriptions.length).toBeGreaterThan(0);
    });

    it('handles successful deploy operation', async () => {

        const deployOperation = deploy.deploy(composeFilePath);
        // process would fire an exit event after being stopped
        exitEmitter.fire(0);
        await waitImmediate();

        expect(deployer.start).toHaveBeenCalledWith(composeFilePath);
        await expect(deployOperation).resolves.toBeUndefined();
    });

    it('handles deploy cancellation', async () => {
        const cancellationEventEmitter = new vscode.EventEmitter<void>();
        let token: vscode.CancellationToken;
        (vscode.window.withProgress as jest.Mock).mockImplementation(async (_opts, cb) => {
            token = {
                onCancellationRequested: cancellationEventEmitter.event,
                isCancellationRequested: false,
            };
            await cb({}, token);
        });

        const deployOperation = deploy.deploy(composeFilePath);
        // simulate cancellation
        token!.isCancellationRequested = true;
        cancellationEventEmitter.fire();
        // process would exit with code null (cancelled by SIGTERM)
        exitEmitter.fire(null);
        await waitImmediate();

        expect(deployer.start).toHaveBeenCalledWith(composeFilePath);
        expect(deployer.stop).toHaveBeenCalled();
        await expect(deployOperation).resolves.toBeUndefined();
    });

    it('handles error on deploy cancellation', async () => {
        const cancellationEventEmitter = new vscode.EventEmitter<void>();
        let token: vscode.CancellationToken;
        (vscode.window.withProgress as jest.Mock).mockImplementation(async (_opts, cb) => {
            token = {
                onCancellationRequested: cancellationEventEmitter.event,
                isCancellationRequested: false,
            };
            await cb({}, token);
        });

        const deployOperation = deploy.deploy(composeFilePath);
        const deployOperationAssertion = expect(deployOperation).rejects.toThrow('Deploy operation exited with code 1');

        // simulate cancellation
        token!.isCancellationRequested = true;
        cancellationEventEmitter.fire();
        // process would exit with error code 1
        exitEmitter.fire(1);
        await waitImmediate();

        expect(deployer.start).toHaveBeenCalledWith(composeFilePath);
        expect(deployer.stop).toHaveBeenCalled();
        await deployOperationAssertion;
    });

    it('handles deploy process errors', async () => {
        const error = new Error('deploy-fail');
        deployer.start = jest.fn().mockRejectedValue(error);

        const deployOperation = deploy.deploy(composeFilePath);
        const deployOperationAssertion = expect(deployOperation).rejects.toThrow('deploy-fail');
        await waitImmediate();

        expect(deployer.start).toHaveBeenCalledWith(composeFilePath);
        expect(logger.error).toHaveBeenCalledWith("Failed to start deployment", error);
        await deployOperationAssertion;
    });

    it('handles other deploy errors', async () => {
        const deployOperation = deploy.deploy(composeFilePath);
        const deployOperationAssertion = expect(deployOperation).rejects.toThrow('Simulated error');
        // simulate cancellation explicitly
        errorEmitter.fire(new Error('Simulated error'));
        await waitImmediate();

        expect(deployer.start).toHaveBeenCalledWith(composeFilePath);
        await deployOperationAssertion;
    });

    it('logs stdout and stderr and shows output channel during deploy', async () => {

        const deployOperation = deploy.deploy(composeFilePath);
        const stdoutData = Buffer.from('hello stdout');
        const stderrData = Buffer.from('hello stderr');
        // Simulate stdout and stderr events
        stdoutDataEmitter.fire(stdoutData);
        stderrDataEmitter.fire(stderrData);
        // Simulate successful exit
        exitEmitter.fire(0);
        await waitImmediate();

        await expect(deployOperation).resolves.toBeUndefined();
        expect(logger.show).toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith(stdoutData);
        expect(logger.error).toHaveBeenCalledWith(stderrData);
    });

    it('invokes handler when command called', async () => {
        deploy.activate();

        const op = deployHandler!(composeFileUri);
        exitEmitter.fire(0);
        await waitImmediate();

        await expect(op).resolves.toBeUndefined();
        expect(deployer.start).toHaveBeenCalledWith(composeFilePath);
    });

    it('logs and shows error when deploy command fails', async () => {
        const error = new Error('deploy-command-fail');
        deployer.start = jest.fn().mockRejectedValue(error);
        deploy.activate();

        deployHandler!(composeFileUri);
        await waitImmediate();

        expect(deployer.start).toHaveBeenCalledWith(composeFilePath);
        expect(logger.error).toHaveBeenCalledWith('Error executing deploy command', error);
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('Error executing deploy command'));
    });

});
