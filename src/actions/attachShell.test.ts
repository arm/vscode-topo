import * as vscode from 'vscode';
import { AttachShell } from '../actions/attachShell';
import { DockerCommands } from '../workloadPlacement/dockerCommands';
import { Target } from '../workloadPlacement/target';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('vscode');
jest.mock('../util/logger');

describe('AttachShell', () => {
    const registerCommandMock = vscode.commands.registerCommand as jest.Mock;
    const dockerCommands = new DockerCommands();
    const target = new Target(
        'topo',
        'user@topo.local',
    );
    const targetStore = {
        getSelectedTarget: jest.fn().mockResolvedValue(target),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        registerCommandMock.mockReturnValue({ dispose: jest.fn() });
        (vscode.window.createTerminal as jest.Mock).mockReturnValue({
            sendText: jest.fn(),
            show: jest.fn(),
        });
    });

    it('registers attachShell command on activate', () => {
        const context = { subscriptions: [] };
        const attachShell = new AttachShell(context as any, dockerCommands, targetStore);
        attachShell.activate();
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(AttachShell.attachShellCommandType, expect.any(Function));
    });

    it('attachShell command opens terminal and sends docker exec', () => {
        const context = { subscriptions: [] };
        const attachShell = new AttachShell(context as any, dockerCommands, targetStore);
        attachShell.activate();
        const attachShellCall = registerCommandMock.mock.calls.find(
            ([cmd]) => cmd === AttachShell.attachShellCommandType
        );
        expect(attachShellCall).toBeDefined();
        const handler = attachShellCall[1];
        const fakeItem = { id: 'cid', image: 'clabel', target };
        handler(fakeItem);
        expect(vscode.window.createTerminal).toHaveBeenCalledWith({ name: 'Shell: clabel' });
        const terminal = (vscode.window.createTerminal as jest.Mock).mock.results[0].value;
        expect(terminal.sendText).toHaveBeenCalledWith(`docker --context ${target.host} exec -it cid sh`);
        expect(terminal.show).toHaveBeenCalled();
    });
});
