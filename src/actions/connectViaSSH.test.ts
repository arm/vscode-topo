import * as vscode from 'vscode';
import { ConnectViaSSH, connectViaSSH } from './connectViaSSH';
import { TargetModel } from '../models/targetModel';

describe('ConnectViaSSH', () => {
    const target = 'user@topo.local';

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('connects to the selected target', () => {
        const targetModel = new TargetModel();
        targetModel.setSelected(target);
        const action = new ConnectViaSSH(targetModel);

        action.connectViaSSHCommandHandler();

        expect(vscode.window.createTerminal).toHaveBeenCalledWith({
            name: `SSH: ${target}`,
            shellPath: 'ssh',
            shellArgs: [target],
        });
        const terminal = vi.mocked(vscode.window.createTerminal).mock.results[0]
            .value;
        expect(terminal.sendText).not.toHaveBeenCalled();
        expect(terminal.show).toHaveBeenCalled();
    });

    it('rejects the action when no target is selected', () => {
        const action = new ConnectViaSSH(new TargetModel());

        expect(() => action.connectViaSSHCommandHandler()).toThrow(
            'No selected target found',
        );
        expect(vscode.window.createTerminal).not.toHaveBeenCalled();
    });
});

describe('connectViaSSH', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('opens an SSH terminal for a target', () => {
        const target = 'user@topo.local';

        connectViaSSH(target);

        expect(vscode.window.createTerminal).toHaveBeenCalledWith({
            name: `SSH: ${target}`,
            shellPath: 'ssh',
            shellArgs: [target],
        });
        const terminal = vi.mocked(vscode.window.createTerminal).mock.results[0]
            .value;
        expect(terminal.sendText).not.toHaveBeenCalled();
        expect(terminal.show).toHaveBeenCalled();
    });
});
