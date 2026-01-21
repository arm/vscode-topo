import * as vscode from 'vscode';
import { AttachShell } from '../actions/attachShell';
import { DockerCommands } from '../workloadPlacement/dockerCommands';
import { Target } from '../workloadPlacement/target';
import { ContainerItem } from '../workloadPlacement/containersManager';
import { TargetTreeContainerItem } from '../workloadPlacement/targetTreeContainerItem';

jest.mock('vscode');
jest.mock('../util/logger');

describe('AttachShell', () => {
    const registerCommandMock = vscode.commands.registerCommand as jest.Mock;
    const dockerCommands = new DockerCommands();
    const target = new Target('topo', 'user@topo.local');
    const targetStore = {
        getSelectedTarget: jest.fn().mockResolvedValue(target),
    };
    const context: Pick<vscode.ExtensionContext, 'subscriptions'> = {
        subscriptions: [],
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

    it('attachShell command opens terminal and sends docker exec', () => {
        const attachShell = new AttachShell(
            context,
            dockerCommands,
            targetStore,
        );
        attachShell.activate();
        const attachShellCall = registerCommandMock.mock.calls.find(
            ([cmd]) => cmd === AttachShell.attachShellCommand,
        );
        expect(attachShellCall).toBeDefined();
        const handler = attachShellCall[1];
        const fakeItem = {
            id: 'cid',
            image: 'clabel',
            target,
            state: 'running',
        } as ContainerItem;
        const treeItem = new TargetTreeContainerItem(fakeItem);

        handler(treeItem);

        expect(vscode.window.createTerminal).toHaveBeenCalledWith({
            name: 'Shell: clabel',
        });
        const terminal = (vscode.window.createTerminal as jest.Mock).mock
            .results[0].value;
        expect(terminal.sendText).toHaveBeenCalledWith(
            `docker --host ssh://${target.ssh} exec -it cid sh`,
        );
        expect(terminal.show).toHaveBeenCalled();
    });
});
