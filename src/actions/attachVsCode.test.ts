import * as vscode from 'vscode';
import { AttachVsCode } from './attachVsCode';
import { exec } from '../util/exec';
import { BOARD_HOST_RUNTIME } from '../manifest';
import { TargetTreeContainerItem } from '../workloadPlacement/targetTreeContainerItem';
import { DockerCommands } from '../workloadPlacement/dockerCommands';
import { Target } from '../workloadPlacement/target';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('../util/exec', () => ({
    exec: jest.fn()
}));
jest.mock('vscode');
jest.mock('../util/logger');

async function executeCommand(command: string, ...args: unknown[]) {
    const calls = (vscode.commands.registerCommand as jest.Mock).mock.calls;
    const addCall = calls.find((c: any[]) => c[0] === command);
    const handler = addCall![1] as (...args: any[]) => Promise<void>;
    await handler(...args);
}

describe('attachVsCode', () => {
    let execMock: jest.Mock;
    let context: any;
    let attachVsCode: AttachVsCode;
    const registerCommandMock = vscode.commands.registerCommand as jest.Mock;
    const dockerCommands = new DockerCommands();
    const target = new Target(
        'topo',
        'user@topo.local',
    );
    const containerItem: TargetTreeContainerItem = {
        id: 'abc123',
        name: 'my-container',
        image: 'nginx',
        state: 'running',
        status: 'Up',
        labels: '',
        runningFor: '',
        runtime: BOARD_HOST_RUNTIME,
        createdAt: '',
        subsystem: 'Host',
        ports: [],
        cpuUsage: '0.0%',
        memUsage: '0B / 1GiB',
        target,
    };
    const dockerContext = 'topo.local';

    beforeEach(() => {
        jest.clearAllMocks();
        execMock = exec as unknown as jest.Mock;
        context = { subscriptions: [] };
        attachVsCode = new AttachVsCode(context, dockerCommands);
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it('registers the command', async () => {
        const registerCommandMock = vscode.commands.registerCommand as jest.Mock;
        registerCommandMock.mockReturnValue({ dispose: jest.fn() });

        await attachVsCode.activate();

        expect(registerCommandMock).toHaveBeenCalledWith(AttachVsCode.attachVsCodeCommand, expect.any(Function));
    });

    it('executes attachVsCode command that doesn\'t create context and calls remote-containers.attachToRunningContainer with container id', async () => {
        registerCommandMock.mockReturnValue({ dispose: jest.fn() });
        await attachVsCode.activate();
        execMock.mockImplementation(async (command) => {
            if (command === 'docker context show') {
                return { stdout: 'default\n', stderr: '' };
            }
            if (command === 'docker context ls --format \'{{.Name}}\'') {
                return { stdout: 'default\ntopo.local\n', stderr: '' };
            }
            if (command === `docker context use ${dockerContext}`) {
                return { stdout: `${dockerContext}\n`, stderr: '' };
            }
            if (command === 'docker context use default') {
                return { stdout: 'default\n', stderr: '' };
            }
            throw new Error(`Unknown command: ${command}`);
        });

        const commandExecution = executeCommand(AttachVsCode.attachVsCodeCommand, containerItem);
        await jest.advanceTimersByTimeAsync(3000);
        await commandExecution;

        expect(execMock).toHaveBeenCalledWith('docker context show');
        expect(execMock).toHaveBeenCalledWith('docker context ls --format \'{{.Name}}\'');
        expect(execMock).toHaveBeenCalledWith(`docker context use ${dockerContext}`);
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith('remote-containers.attachToRunningContainer', containerItem.id);
        expect(execMock).toHaveBeenLastCalledWith('docker context use default');
    });

    it('executes attachVsCode command that creates context and calls remote-containers.attachToRunningContainer with container id', async () => {
        registerCommandMock.mockReturnValue({ dispose: jest.fn() });
        await attachVsCode.activate();
        execMock.mockImplementation(async (command) => {
            if (command === 'docker context show') {
                return { stdout: 'default\n', stderr: '' };
            }
            if (command === 'docker context ls --format \'{{.Name}}\'') {
                return { stdout: 'default\n', stderr: '' };
            }
            if (command === `docker context use ${dockerContext}`) {
                return { stdout: `${dockerContext}\n`, stderr: '' };
            }
            if (command === 'docker context use default') {
                return { stdout: 'default\n', stderr: '' };
            }
            if (command === `docker context create ${dockerContext} --docker host=ssh://${target.ssh}`) {
                return { stdout: '', stderr: '' };
            }
            throw new Error(`Unknown command: ${command}`);
        });

        const commandExecution = executeCommand(AttachVsCode.attachVsCodeCommand, containerItem);
        await jest.advanceTimersByTimeAsync(3000);
        await commandExecution;

        expect(execMock).toHaveBeenCalledWith('docker context show');
        expect(execMock).toHaveBeenCalledWith('docker context ls --format \'{{.Name}}\'');
        expect(execMock).toHaveBeenCalledWith(`docker context create ${dockerContext} --docker host=ssh://${target.ssh}`);
        expect(execMock).toHaveBeenCalledWith(`docker context use ${dockerContext}`);
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith('remote-containers.attachToRunningContainer', containerItem.id);
        expect(execMock).toHaveBeenLastCalledWith('docker context use default');
    });

    it('shows an error if the attachVsCode command fails', async () => {
        registerCommandMock.mockReturnValue({ dispose: jest.fn() });
        await attachVsCode.activate();
        execMock.mockImplementation(async () => {
            throw new Error('Fail');
        });

        const commandExecution = executeCommand(AttachVsCode.attachVsCodeCommand, containerItem);
        await jest.advanceTimersByTimeAsync(3000);
        await commandExecution;

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Failed to attach VS Code to container: Fail');
    });
});
