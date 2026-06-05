import * as vscode from 'vscode';
import {
    AttachShell,
    attachShell as openAttachShell,
    attachSSH,
} from '../actions/attachShell';
import { mock } from 'vitest-mock-extended';
import { ContainerItem } from '../util/types';
import { DockerCommands } from '../target/dockerCommands';
import { TargetContainerTreeItem } from '../targetTreeView/targetContainerTreeItem';

vi.mock('../util/logger');

describe('AttachShell', () => {
    const dockerCommands = new DockerCommands();
    const target = 'user@topo.local';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('attachShell command opens a docker exec terminal', async () => {
        const attachShell = new AttachShell(dockerCommands);
        const fakeItem = mock<ContainerItem>({
            id: 'cid',
            image: 'clabel',
            target,
            state: 'running',
        });
        const treeItem = new TargetContainerTreeItem(fakeItem);

        await attachShell.attachShellCommandHandler(treeItem);

        const expectedCommand = dockerCommands.getAttachShellCommand(
            fakeItem.id,
            fakeItem.target,
        );
        expect(vscode.window.createTerminal).toHaveBeenCalledWith({
            name: 'Shell: clabel',
            shellPath: expectedCommand[0],
            shellArgs: expectedCommand.slice(1),
        });
        const terminal = vi.mocked(vscode.window.createTerminal).mock.results[0]
            .value;
        expect(terminal.sendText).not.toHaveBeenCalled();
        expect(terminal.show).toHaveBeenCalled();
    });

    it('attachShell opens a docker exec terminal', () => {
        const fakeItem = mock<ContainerItem>({
            id: 'cid',
            image: 'clabel',
            target,
            state: 'running',
        });

        openAttachShell(fakeItem, dockerCommands);

        const expectedCommand = dockerCommands.getAttachShellCommand(
            fakeItem.id,
            fakeItem.target,
        );
        expect(vscode.window.createTerminal).toHaveBeenCalledWith({
            name: 'Shell: clabel',
            shellPath: expectedCommand[0],
            shellArgs: expectedCommand.slice(1),
        });
        const terminal = vi.mocked(vscode.window.createTerminal).mock.results[0]
            .value;
        expect(terminal.sendText).not.toHaveBeenCalled();
        expect(terminal.show).toHaveBeenCalled();
    });

    it('attachSSH opens terminal for a target', () => {
        attachSSH(target);

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
