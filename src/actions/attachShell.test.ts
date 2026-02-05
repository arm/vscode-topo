import * as vscode from 'vscode';
import { AttachShell } from '../actions/attachShell';
import { DockerCommands } from '../workloadPlacement/dockerCommands';
import { Target } from '../workloadPlacement/target';
import { ContainerItem } from '../workloadPlacement/containersManager';
import { TargetTreeContainerItem } from '../workloadPlacement/targetTreeContainerItem';
import { mock, MockProxy } from 'jest-mock-extended';
import { TargetStore } from '../workloadPlacement/targetStore';

jest.mock('vscode');
jest.mock('../util/logger');

describe('AttachShell', () => {
    const registerCommandMock = jest.mocked(vscode.commands.registerCommand);
    const dockerCommands = new DockerCommands();
    const target = new Target('topo', 'user@topo.local');
    const targetStore = mock<TargetStore>();
    let context: MockProxy<vscode.ExtensionContext>;

    beforeEach(() => {
        context = mock<vscode.ExtensionContext>({ subscriptions: [] });
        targetStore.getSelectedTarget.mockResolvedValue(target);
    });

    afterEach(() => {
        jest.clearAllMocks();
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
        const handler = attachShellCall![1];
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
        const terminal = jest.mocked(vscode.window.createTerminal).mock
            .results[0].value;
        expect(terminal.sendText).toHaveBeenCalledWith(
            `docker --host ssh://${target.ssh} exec -it cid sh`,
        );
        expect(terminal.show).toHaveBeenCalled();
    });
});
