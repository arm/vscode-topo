import * as vscode from 'vscode';
import {
    AttachShell,
    attachShell as openAttachShell,
    attachSSH,
} from '../actions/attachShell';
import { mock, MockProxy } from 'vitest-mock-extended';
import { ContainerItem } from '../util/types';
import { DockerCommands } from '../target/dockerCommands';
import { TargetContainerTreeItem } from '../targetTreeView/targetContainerTreeItem';
import { executeCommand } from '../util/test/executeCommand';

vi.mock('../util/logger');

describe('AttachShell', () => {
    const dockerCommands = new DockerCommands();
    const target = 'user@topo.local';
    let context: MockProxy<vscode.ExtensionContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        context = mock<vscode.ExtensionContext>({ subscriptions: [] });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('registers attachShell command on activate', () => {
        const attachShell = new AttachShell(context, dockerCommands);
        attachShell.activate();
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            AttachShell.attachShellCommand,
            expect.any(Function),
        );
    });

    it('attachShell command opens terminal and sends docker exec', async () => {
        const attachShell = new AttachShell(context, dockerCommands);
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
            `docker --host ssh://${target} exec -it cid sh`,
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
        expect(terminal.sendText).toHaveBeenCalledWith(`ssh ${target}`);
        expect(terminal.show).toHaveBeenCalled();
    });
});
