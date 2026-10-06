import * as vscode from 'vscode';
import { OpenContainerShell } from './openContainerShell';
import { mock } from 'vitest-mock-extended';
import { ContainerItem } from '../util/types';
import { ContainerCommands } from '../services/containerCommands';
import { ContainerTreeItem } from '../views/treeItems/containerTreeItem';

describe('OpenContainerShell', () => {
    const target = 'user@topo.local';

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('opens the provided shell command in a terminal', async () => {
        const containerCommands = mock<ContainerCommands>();
        containerCommands.getAttachShellCommand.mockReturnValue([
            'podman',
            'exec',
            '-it',
            'cid',
            'sh',
        ]);
        const openContainerShellAction = new OpenContainerShell(
            containerCommands,
        );
        const fakeItem = mock<ContainerItem>({
            id: 'cid',
            image: 'clabel',
            target,
            state: 'running',
            address: '',
        });
        const treeItem = new ContainerTreeItem(fakeItem);

        await openContainerShellAction.openContainerShellCommandHandler(
            treeItem,
        );

        expect(
            containerCommands.getAttachShellCommand,
        ).toHaveBeenCalledExactlyOnceWith('cid', target);
        expect(vscode.window.createTerminal).toHaveBeenCalledWith({
            name: 'Shell: clabel',
            shellPath: 'podman',
            shellArgs: ['exec', '-it', 'cid', 'sh'],
        });
        const terminal = vi.mocked(vscode.window.createTerminal).mock.results[0]
            .value;
        expect(terminal.sendText).not.toHaveBeenCalled();
        expect(terminal.show).toHaveBeenCalled();
    });
});
