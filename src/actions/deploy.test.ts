import path from 'path';
import * as vscode from 'vscode';
import { logger } from '../util/logger';
import { Deploy } from './deploy';
import { DeployerType } from './deploy';

jest.mock('vscode');
jest.mock('../util/logger');

const waitImmediate = () => new Promise<void>(resolve => setTimeout(() => resolve(), 0));

describe('Deploy', () => {
    let deploy: Deploy;
    const composeFilePath: string = '/tmp/compose.topo.yaml';
    let deployer: DeployerType;
    let stdoutDataEmitter: vscode.EventEmitter<Buffer>;
    let stderrDataEmitter: vscode.EventEmitter<Buffer>;
    let exitEmitter: vscode.EventEmitter<number | null>;
    let errorEmitter: vscode.EventEmitter<Error>;

    beforeEach(() => {
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
        deploy = new Deploy(deployer);
        (vscode.window.withProgress as jest.Mock).mockImplementation(async (_opts, cb) => {
            const token = {
                onCancellationRequested: (cb2: () => void) => cb2(),
            };
            await cb({}, token);
        });
        jest.clearAllMocks();
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
        const composeFolder = '/ext';
        const composeFilePath = path.resolve(composeFolder, 'compose.yaml');
        let cancellationCallback: () => void;
        (vscode.window.withProgress as jest.Mock).mockImplementation(async (_opts, cb) => {
            const token = {
                onCancellationRequested: (cb2: () => void) => {
                    cancellationCallback = cb2;
                },
            };
            await cb({}, token);
        });

        const deployOperation = deploy.deploy(composeFilePath);
        const deployOperationAssertion = expect(deployOperation).rejects.toThrow('Deploy operation exited with code 130');
        cancellationCallback!();
        exitEmitter.fire(130);
        await waitImmediate();

        expect(deployer.start).toHaveBeenCalledWith(composeFilePath);
        await deployOperationAssertion;
    });

    it('handles deploy process errors', async () => {
        const composeFolder = '/ext';
        const composeFilePath = path.resolve(composeFolder, 'compose.yaml');
        const error = new Error('deploy-fail');
        deployer.start = jest.fn().mockRejectedValue(error);

        const deployOperation = deploy.deploy(composeFilePath);
        const deployOperationAssertion = expect(deployOperation).rejects.toThrow('deploy-fail');
        await waitImmediate();

        expect(deployer.start).toHaveBeenCalledWith(composeFilePath);
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("An error happened while starting deployment");
        expect(logger.error).toHaveBeenCalledWith("Failed to start deployment", error);
        await deployOperationAssertion;
    });

    it('handles other deploy errors', async () => {
        const composeFolder = '/ext';
        const composeFilePath = path.resolve(composeFolder, 'compose.yaml');

        const deployOperation = deploy.deploy(composeFilePath);
        const deployOperationAssertion = expect(deployOperation).rejects.toThrow('Simulated error');
        // simulate cancellation explicitly
        errorEmitter.fire(new Error('Simulated error'));
        await waitImmediate();

        expect(deployer.start).toHaveBeenCalledWith(composeFilePath);
        await deployOperationAssertion;
    });

    it('logs stdout and stderr and shows output channel during deploy', async () => {
        const composeFolder = '/ext';
        const composeFilePath = path.resolve(composeFolder, 'compose.yaml');

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

});
