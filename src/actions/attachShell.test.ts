import * as vscode from 'vscode';
import { AttachShell } from '../actions/attachShell';
import { BOARD_DOCKER_CONTEXT } from '../manifest';
import { DockerCommands } from '../workloadPlacement/dockerCommands';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('vscode');
jest.mock('../util/logger');

describe('AttachShell', () => {
    const registerCommandMock = vscode.commands.registerCommand as jest.Mock;
    const dockerCommands = new DockerCommands();

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
        const attachShell = new AttachShell(context as any, dockerCommands);
        attachShell.activate();
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(AttachShell.attachShellCommandType, expect.any(Function));
    });

    it('attachShell command opens terminal and sends docker exec', () => {
        const context = { subscriptions: [] };
        const attachShell = new AttachShell(context as any, dockerCommands);
        attachShell.activate();
        const attachShellCall = registerCommandMock.mock.calls.find(
            ([cmd]) => cmd === AttachShell.attachShellCommandType
        );
        expect(attachShellCall).toBeDefined();
        const handler = attachShellCall[1];
        const fakeItem = { id: 'cid', image: 'clabel' };
        handler(fakeItem);
        expect(vscode.window.createTerminal).toHaveBeenCalledWith({ name: 'Shell: clabel' });
        const terminal = (vscode.window.createTerminal as jest.Mock).mock.results[0].value;
        expect(terminal.sendText).toHaveBeenCalledWith(`docker --context ${BOARD_DOCKER_CONTEXT} exec -it cid sh`);
        expect(terminal.show).toHaveBeenCalled();
    });
});
