import * as vscode from 'vscode';
import { AttachVscode } from './attachVscode';
import { exec } from '../util/exec';
import { BOARD_DOCKER_CONTEXT, BOARD_HOST_RUNTIME } from '../manifest';
import { ContainerTreeItem } from '../workloadPlacement/containerTreeItems';
import { DockerCommands } from '../workloadPlacement/dockerCommands';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('../util/exec', () => ({
    exec: jest.fn()
}));
jest.mock('vscode');
jest.mock('../util/logger');

describe('attachVscode', () => {
    let execMock: jest.Mock;
    let context: any;
    let attachVscode: AttachVscode;
    const registerCommandMock = vscode.commands.registerCommand as jest.Mock;
    const dockerCommands = new DockerCommands();

    beforeEach(() => {
        jest.clearAllMocks();
        execMock = exec as unknown as jest.Mock;
        context = { subscriptions: [] };
        attachVscode = new AttachVscode(context, dockerCommands);
    });

    it('registers the command', async () => {
        const registerCommandMock = vscode.commands.registerCommand as jest.Mock;
        registerCommandMock.mockReturnValue({ dispose: jest.fn() });

        await attachVscode.activate();

        expect(registerCommandMock).toHaveBeenCalledWith('containerExplorer.attachVscode', expect.any(Function));
    });

    it('attachVscode command calls remote-containers.attachToRunningContainer with container id', async () => {
        jest.useFakeTimers();
        const containerItem: ContainerTreeItem = {
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
        };
        registerCommandMock.mockReturnValue({ dispose: jest.fn() });
        await attachVscode.activate();
        execMock.mockImplementation(async (command) => {
            if (command === 'docker context show') {
                return { stdout: 'default\n', stderr: '' };
            }
            if (command === `docker context use ${BOARD_DOCKER_CONTEXT}`) {
                return { stdout: `${BOARD_DOCKER_CONTEXT}\n`, stderr: '' };
            }
            if (command === 'docker context use default') {
                return { stdout: 'default\n', stderr: '' };
            }
            throw new Error(`Unknown command: ${command}`);
        });
        const registerCall = registerCommandMock.mock.calls.find(
            ([cmd]: [string, unknown]) => cmd === 'containerExplorer.attachVscode'
        );
        const handler = registerCall[1];

        handler(containerItem);
        await jest.advanceTimersByTimeAsync(3000);

        expect(execMock).toHaveBeenCalledWith('docker context show');
        expect(execMock).toHaveBeenCalledWith(`docker context use ${BOARD_DOCKER_CONTEXT}`);
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith('remote-containers.attachToRunningContainer', containerItem.id);
        expect(execMock).toHaveBeenLastCalledWith('docker context use default');
    });
});
