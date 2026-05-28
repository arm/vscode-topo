import * as vscode from 'vscode';
import { AttachShell } from '../actions/attachShell';
import { mock, MockProxy } from 'vitest-mock-extended';
import { ContainerItem } from '../util/types';
import { DockerCommands } from '../target/dockerCommands';
import { TargetContainerTreeItem } from '../targetTreeView/targetContainerTreeItem';
import { executeCommand } from '../util/test/executeCommand';
import { TargetModel } from '../models/targetModel';

vi.mock('../util/logger');

describe('AttachShell', () => {
    const dockerCommands = new DockerCommands();
    const target = 'user@topo.local';
    const targetModel = new TargetModel();
    let context: MockProxy<vscode.ExtensionContext>;

    beforeEach(() => {
        context = mock<vscode.ExtensionContext>({ subscriptions: [] });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('registers attachShell command on activate', () => {
        const attachShell = new AttachShell(
            context,
            dockerCommands,
            targetModel,
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
            targetModel,
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
});
