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

    it('attachShell command opens terminal and sends docker exec', async () => {
        const attachShell = new AttachShell(dockerCommands);
        const fakeItem = mock<ContainerItem>({
            id: 'cid',
            image: 'clabel',
            target,
            state: 'running',
        });
        const treeItem = new TargetContainerTreeItem(fakeItem);

        await attachShell.attachShellCommandHandler(treeItem);

        expect(vscode.window.createTerminal).toHaveBeenCalledWith({
            name: 'Shell: clabel',
        });
        const terminal = vi.mocked(vscode.window.createTerminal).mock.results[0]
            .value;
        expect(terminal.sendText).toHaveBeenCalledWith(
            `docker --host 'ssh://${target}' exec -it 'cid' sh`,
        );
        expect(terminal.show).toHaveBeenCalled();
    });

    it('attachShell opens terminal and sends docker exec', () => {
        const fakeItem = mock<ContainerItem>({
            id: 'cid',
            image: 'clabel',
            target,
            state: 'running',
        });

        openAttachShell(fakeItem, dockerCommands);

        expect(vscode.window.createTerminal).toHaveBeenCalledWith({
            name: 'Shell: clabel',
        });
        const terminal = vi.mocked(vscode.window.createTerminal).mock.results[0]
            .value;
        expect(terminal.sendText).toHaveBeenCalledWith(
            `docker --host 'ssh://${target}' exec -it 'cid' sh`,
        );
        expect(terminal.show).toHaveBeenCalled();
    });

    it('attachSSH opens terminal for a target', () => {
        attachSSH(target);

        expect(vscode.window.createTerminal).toHaveBeenCalledWith({
            name: `SSH: ${target}`,
        });
        const terminal = vi.mocked(vscode.window.createTerminal).mock.results[0]
            .value;
        expect(terminal.sendText).toHaveBeenCalledWith(`ssh '${target}'`);
        expect(terminal.show).toHaveBeenCalled();
    });

    it('attachSSH quotes shell metacharacters in the target', () => {
        const targetWithShellSyntax = `user@topo.local'; touch /tmp/pwned`;

        attachSSH(targetWithShellSyntax);

        const terminal = vi.mocked(vscode.window.createTerminal).mock.results[0]
            .value;
        expect(terminal.sendText).toHaveBeenCalledWith(
            `ssh 'user@topo.local'\\''; touch /tmp/pwned'`,
        );
        expect(terminal.show).toHaveBeenCalled();
    });
});
