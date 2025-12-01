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
    const dockerContext = 'topo.local';

    beforeEach(() => {
        jest.clearAllMocks();
        execMock = exec as unknown as jest.Mock;
        context = { subscriptions: [] };
        attachVsCode = new AttachVsCode(context, dockerCommands);
    });

    it('registers the command', async () => {
        const registerCommandMock = vscode.commands.registerCommand as jest.Mock;
        registerCommandMock.mockReturnValue({ dispose: jest.fn() });

        await attachVsCode.activate();

        expect(registerCommandMock).toHaveBeenCalledWith(AttachVsCode.attachVsCodeCommandType, expect.any(Function));
    });

    it('attachVsCode command calls remote-containers.attachToRunningContainer with container id', async () => {
        jest.useFakeTimers();
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
        registerCommandMock.mockReturnValue({ dispose: jest.fn() });
        await attachVsCode.activate();
        execMock.mockImplementation(async (command) => {
            if (command === 'docker context show') {
                return { stdout: 'default\n', stderr: '' };
            }
            if (command === `docker context use ${dockerContext}`) {
                return { stdout: `${dockerContext}\n`, stderr: '' };
            }
            if (command === 'docker context use default') {
                return { stdout: 'default\n', stderr: '' };
            }
            throw new Error(`Unknown command: ${command}`);
        });
        const registerCall = registerCommandMock.mock.calls.find(
            ([cmd]: [string, unknown]) => cmd === AttachVsCode.attachVsCodeCommandType
        );
        const handler = registerCall[1];

        handler(containerItem);
        await jest.advanceTimersByTimeAsync(3000);

        expect(execMock).toHaveBeenCalledWith('docker context show');
        expect(execMock).toHaveBeenCalledWith(`docker context use ${dockerContext}`);
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith('remote-containers.attachToRunningContainer', containerItem.id);
        expect(execMock).toHaveBeenLastCalledWith('docker context use default');
    });
});
