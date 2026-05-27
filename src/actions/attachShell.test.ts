import * as vscode from 'vscode';
import { AttachShell } from '../actions/attachShell';
import { mock, MockProxy } from 'vitest-mock-extended';
import { ContainerItem } from '../util/types';
import { TargetStore } from '../target/targetStore';
import { DockerCommands } from '../target/dockerCommands';
import { TargetContainerTreeItem } from '../targetTreeView/targetContainerTreeItem';
import { WrappedError } from '../errors/wrappedError';
import { executeCommand } from '../util/test/executeCommand';

vi.mock('../util/logger');

describe('AttachShell', () => {
    const dockerCommands = new DockerCommands();
    const target = 'user@topo.local';
    const targetStore = mock<TargetStore>();
    let context: MockProxy<vscode.ExtensionContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        targetStore.getSelectedTarget.mockReset();
        targetStore.getSelectedTarget.mockReturnValue(target);
        context = mock<vscode.ExtensionContext>({ subscriptions: [] });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('registers attachShell command on activate', () => {
        const attachShell = new AttachShell(
            context,
            dockerCommands,
            targetStore,
        );
        attachShell.activate();
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            AttachShell.attachShellCommand,
            expect.any(Function),
        );
    });

    it('attachShell command opens terminal and sends docker exec', async () => {
        const attachShell = new AttachShell(
            context,
            dockerCommands,
            targetStore,
        );
        attachShell.activate();
        const fakeItem = mock<ContainerItem>({
            id: 'cid',
            image: 'clabel',
            target,
            state: 'running',
        });
        const treeItem = new TargetContainerTreeItem(fakeItem);

        await executeCommand(AttachShell.attachShellCommand, treeItem);

        expect(vscode.window.createTerminal).toHaveBeenCalledWith({
            name: 'Shell: clabel',
        });
        const terminal = vi.mocked(vscode.window.createTerminal).mock.results[0]
            .value;
        expect(terminal.sendText).toHaveBeenCalledWith(
            `docker --host ssh://${target} exec -it cid sh`,
        );
        expect(terminal.show).toHaveBeenCalled();
    });

    it('attachSSH opens terminal for the selected target', async () => {
        const attachShell = new AttachShell(
            context,
            dockerCommands,
            targetStore,
        );

        attachShell.attachSSH();

        expect(vscode.window.createTerminal).toHaveBeenCalledWith({
            name: `SSH: ${target}`,
        });
        const terminal = vi.mocked(vscode.window.createTerminal).mock.results[0]
            .value;
        expect(terminal.sendText).toHaveBeenCalledWith(`ssh ${target}`);
        expect(terminal.show).toHaveBeenCalled();
    });

    it('shows an error when attachSSH cannot load the selected target', async () => {
        targetStore.getSelectedTarget.mockImplementationOnce(() => {
            throw new WrappedError('TARGET', 'target store failed');
        });
        const attachShell = new AttachShell(
            context,
            dockerCommands,
            targetStore,
        );

        attachShell.attachSSH();

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Failed to attach SSH. target store failed',
        );
        expect(vscode.window.createTerminal).not.toHaveBeenCalled();
    });

    it('rethrows non-TARGET errors from attachSSH target lookup', async () => {
        targetStore.getSelectedTarget.mockImplementationOnce(() => {
            throw new Error('target lookup failed');
        });
        const attachShell = new AttachShell(
            context,
            dockerCommands,
            targetStore,
        );

        expect(() => attachShell.attachSSH()).toThrow('target lookup failed');
        expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
        expect(vscode.window.createTerminal).not.toHaveBeenCalled();
    });
});
