import { TargetTreeDataProvider } from './targetTreeDataProvider';
import { TargetTreeContainerItem } from './targetTreeContainerItem';
import { TargetTreeSubsystemItem } from './targetTreeSubsystemItem';
import { TargetTreeBoardItem } from './targetTreeBoardItem';
import * as vscode from 'vscode';
import * as manifest from '../manifest';
import { ContainerItem, ContainersManager } from './containersManager';
import { Target } from './target';

jest.mock('../util/logger');
jest.mock('vscode');

async function executeCommand(command: string, ...args: unknown[]) {
    const calls = (vscode.commands.registerCommand as jest.Mock).mock.calls;
    const matching = calls.filter((c: unknown[]) => c[0] === command);
    if (!matching.length) {
        throw new Error(`No handler registered for command ${command}`);
    }
    const addCall = matching[matching.length - 1];
    const handler = addCall[1] as (...args: unknown[]) => Promise<void>;
    await handler(...args);
}

describe('TargetTreeDataProvider', () => {
    let provider: TargetTreeDataProvider;
    let context: Pick<vscode.ExtensionContext, 'subscriptions'>;
    let containersManagerMock: jest.Mocked<
        Pick<
            ContainersManager,
            | 'getContainersData'
            | 'startAutoRefresh'
            | 'stopAutoRefresh'
            | 'onDataUpdate'
            | 'getBoardState'
        >
    >;
    const target = new Target('topo', 'user@topo.local');

    const mockContainers: ContainerItem[] = [
        {
            id: 'id1',
            name: 'cont1',
            image: 'img1',
            state: 'running',
            status: 'Up 4 days',
            labels: 'foo=bar',
            runningFor: '1h',
            runtime: manifest.BOARD_AMBIENT_RUNTIME,
            createdAt: '',
            ports: [],
            cpuUsage: '0.0%',
            memUsage: '0B / 1GiB',
            target,
        },
        {
            id: 'id2',
            name: 'cont2',
            image: 'img2',
            state: 'exited',
            status: 'Exited (0) 2 hours ago',
            labels: 'baz=qux',
            runningFor: '2h',
            runtime: manifest.BOARD_HOST_RUNTIME,
            createdAt: '',
            ports: [],
            cpuUsage: '0.0%',
            memUsage: '0B / 1GiB',
            target,
        },
        {
            id: 'id3',
            name: 'cont3',
            image: 'img3',
            state: 'running',
            status: 'Up 1 hour',
            labels: 'abc=def',
            runningFor: '30m',
            runtime: manifest.BOARD_AMBIENT_RUNTIME,
            createdAt: '',
            ports: [],
            cpuUsage: '0.0%',
            memUsage: '0B / 1GiB',
            target,
        },
    ];
    const targetStoreMock = {
        onChanged: jest.fn(),
        getSelectedTarget: jest.fn().mockResolvedValue(target),
        getTargets: jest.fn(),
        setSelected: jest.fn(),
        deleteTarget: jest.fn(),
    };

    beforeEach(() => {
        const boardState = { isReachable: true, hasContainerRuntime: true };
        context = { subscriptions: [] };
        containersManagerMock = {
            getContainersData: jest.fn().mockResolvedValue(mockContainers),
            startAutoRefresh: jest.fn(),
            stopAutoRefresh: jest.fn(),
            onDataUpdate: jest.fn(),
            getBoardState: jest.fn().mockResolvedValue(boardState),
        };
        provider = new TargetTreeDataProvider(
            context,
            containersManagerMock,
            targetStoreMock,
        );
        jest.clearAllTimers();
        jest.clearAllMocks();
    });

    describe('activation / registration', () => {
        it('registers the selectTarget command when activated', async () => {
            await provider.activate();

            expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
                TargetTreeDataProvider.selectTargetCommand,
                expect.any(Function),
            );
            expect(context.subscriptions.length).toBeGreaterThan(0);
        });
    });

    describe('getChildren', () => {
        it('returns Board at root and Host/Ambient as its children', async () => {
            targetStoreMock.getTargets.mockReturnValue([target]);
            const rootChildren = await provider.getChildren();
            expect(rootChildren).toHaveLength(1);
            expect(rootChildren[0].label).toBe('topo');

            const boardChildren = await provider.getChildren(rootChildren[0]);

            expect(boardChildren).toHaveLength(2);
            expect(boardChildren[0]).toBeInstanceOf(TargetTreeSubsystemItem);
            expect(boardChildren[1]).toBeInstanceOf(TargetTreeSubsystemItem);
            expect((boardChildren[0] as TargetTreeSubsystemItem).group).toBe(
                'Host',
            );
            expect((boardChildren[1] as TargetTreeSubsystemItem).group).toBe(
                'Ambient',
            );
        });

        it('returns containers for Host and Ambient groups', async () => {
            const hostGroup = new TargetTreeSubsystemItem('Host');
            const hostChildren = await provider.getChildren(hostGroup);
            expect(hostChildren).toHaveLength(1);
            expect(hostChildren[0]).toBeInstanceOf(TargetTreeContainerItem);
            expect((hostChildren[0] as TargetTreeContainerItem).name).toBe(
                'cont2',
            );
            const ambientGroup = new TargetTreeSubsystemItem('Ambient');

            const ambientChildren = await provider.getChildren(ambientGroup);

            expect(ambientChildren).toHaveLength(2);
            expect(ambientChildren[0]).toBeInstanceOf(TargetTreeContainerItem);
            expect(
                ambientChildren.map((c) => (c as TargetTreeContainerItem).name),
            ).toEqual(expect.arrayContaining(['cont1', 'cont3']));
            const sortedNames = ambientChildren.map(
                (c) => (c as TargetTreeContainerItem).name,
            );
            expect(sortedNames).toEqual(['cont1', 'cont3']);
        });

        it('handles parsing error in getContainersData gracefully', async () => {
            containersManagerMock.getContainersData.mockResolvedValueOnce([]);
            const ambientGroup = new TargetTreeSubsystemItem('Ambient');

            const children = await provider.getChildren(ambientGroup);

            expect(children).toEqual([]);
        });

        it('returns empty array when there are no targets', async () => {
            targetStoreMock.getTargets.mockReturnValue([]);
            containersManagerMock.getBoardState.mockResolvedValueOnce({
                isReachable: false,
                hasContainerRuntime: true,
                targetId: target.id,
            });

            const rootChildren = await provider.getChildren();

            expect(rootChildren.length).toEqual(0);
        });
    });

    describe('getTreeItem', () => {
        it('getTreeItem returns the element itself', () => {
            const item = new TargetTreeSubsystemItem('Host');

            const treeItem = provider.getTreeItem(item);

            expect(treeItem).toBe(item);
        });
    });

    describe('refresh', () => {
        it('refresh fires the event', () => {
            const spy = jest.fn();
            provider.onDidChangeTreeData(spy);

            provider.refresh();

            expect(spy).toHaveBeenCalledWith(undefined);
        });
    });

    describe('selectTarget command', () => {
        it('invokes targetStore.setSelected when select command is executed with a board item', async () => {
            await provider.activate();
            const boardItem = new TargetTreeBoardItem(target, true, true, true);

            await executeCommand(
                TargetTreeDataProvider.selectTargetCommand,
                boardItem,
            );

            expect(targetStoreMock.setSelected).toHaveBeenCalledWith(target.id);
        });

        it('does not call setSelected when select command is executed with a non-board item', async () => {
            await provider.activate();

            await executeCommand(TargetTreeDataProvider.selectTargetCommand);

            expect(targetStoreMock.setSelected).not.toHaveBeenCalled();
        });
    });

    describe('removeTarget command', () => {
        it('invokes targetStore.deleteTarget when remove command is executed with a board item', async () => {
            const boardItem = new TargetTreeBoardItem(target, true, true, true);
            targetStoreMock.getTargets.mockReturnValue([target]);
            await provider.activate();

            await executeCommand(
                TargetTreeDataProvider.removeTargetCommand,
                boardItem,
            );

            expect(targetStoreMock.deleteTarget).toHaveBeenCalledWith(
                target.id,
            );
        });

        it('does not call deleteTarget when remove command is executed with a non-board item', async () => {
            await provider.activate();

            await executeCommand(TargetTreeDataProvider.removeTargetCommand);

            expect(targetStoreMock.deleteTarget).not.toHaveBeenCalled();
        });

        it('shows an error when deleteTarget fails', async () => {
            const boardItem = new TargetTreeBoardItem(target, true, true, true);
            targetStoreMock.deleteTarget.mockRejectedValue(
                new Error('Target not found'),
            );
            await provider.activate();

            await executeCommand(
                TargetTreeDataProvider.removeTargetCommand,
                boardItem,
            );

            expect(vscode.window.showErrorMessage).toHaveBeenCalled();
        });
    });
});
