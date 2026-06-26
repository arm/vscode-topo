import * as vscode from 'vscode';
import {
    OpenContainerShell,
    openContainerShell,
    attachSSH,
} from '../actions/openContainerShell';
import { mock } from 'vitest-mock-extended';
import { ContainerItem } from '../util/types';
import { DockerCommands } from '../target/dockerCommands';
import { ContainerTreeItem } from '../views/treeItems/containerTreeItem';

vi.mock('../util/logger');

describe('OpenContainerShell', () => {
    const dockerCommands = new DockerCommands();
    const target = 'user@topo.local';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('openContainerShell command opens a docker exec terminal', async () => {
        const openContainerShellAction = new OpenContainerShell(dockerCommands);
        const fakeItem = mock<ContainerItem>({
            id: 'cid',
            image: 'clabel',
            target,
            state: 'running',
        });
        const treeItem = new ContainerTreeItem(fakeItem);

        await openContainerShellAction.openContainerShellCommandHandler(
            treeItem,
        );

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

    it('openContainerShell opens a docker exec terminal', () => {
        const fakeItem = mock<ContainerItem>({
            id: 'cid',
            image: 'clabel',
            target,
            state: 'running',
        });

        openContainerShell(fakeItem, dockerCommands);

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
