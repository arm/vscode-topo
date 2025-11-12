import { TargetTreeDataProvider } from './targetTreeDataProvider';
import { ContainerTreeItem } from './containerTreeItems';
import { SubsystemTreeItem } from './targetTreeDataProvider';
import * as manifest from '../manifest';
import { ContainerItem } from './containersManager';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('TargetTreeDataProvider', () => {
    let provider: TargetTreeDataProvider;
    let containersManagerMock: any;

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
        }
    ];

    beforeEach(() => {
        const boardState = { isReachable: true, hasContainerRuntime: true };
        containersManagerMock = {
            getContainersData: jest.fn().mockResolvedValue(mockContainers),
            startAutoRefresh: jest.fn(),
            stopAutoRefresh: jest.fn(),
            onDataUpdate: jest.fn(),
            getBoardState: jest.fn().mockResolvedValue(boardState),
        };
        provider = new TargetTreeDataProvider(containersManagerMock);
        jest.clearAllTimers();
    });

    it('returns Board at root and Host/Ambient as its children', async () => {
        const rootChildren = await provider.getChildren();
        expect(rootChildren).toHaveLength(1);
        expect(rootChildren[0].label).toBe('Board');

        // Get children of Board
        const boardChildren = await provider.getChildren(rootChildren[0]);
        expect(boardChildren).toHaveLength(2);
        expect(boardChildren[0]).toBeInstanceOf(SubsystemTreeItem);
        expect(boardChildren[1]).toBeInstanceOf(SubsystemTreeItem);
        expect((boardChildren[0] as SubsystemTreeItem).group).toBe('Host');
        expect((boardChildren[1] as SubsystemTreeItem).group).toBe('Ambient');
    });

    it('returns containers for Host and Ambient groups', async () => {
    // Host group: should filter out containers with runtime === manifest.BOARD_AMBIENT_RUNTIME
        const hostGroup = new SubsystemTreeItem('Host');
        const hostChildren = await provider.getChildren(hostGroup);
        expect(hostChildren).toHaveLength(1);
        expect(hostChildren[0]).toBeInstanceOf(ContainerTreeItem);
        expect((hostChildren[0] as ContainerTreeItem).name).toBe('cont2');

        // Ambient group: should include containers with runtime === manifest.BOARD_AMBIENT_RUNTIME
        const ambientGroup = new SubsystemTreeItem('Ambient');
        const ambientChildren = await provider.getChildren(ambientGroup);
        expect(ambientChildren).toHaveLength(2);
        expect(ambientChildren[0]).toBeInstanceOf(ContainerTreeItem);
        expect(ambientChildren.map(c => (c as ContainerTreeItem).name)).toEqual(expect.arrayContaining(['cont1', 'cont3']));
        // Assert running containers are sorted before non-running containers, and by name
        const sortedNames = ambientChildren.map(c => (c as ContainerTreeItem).name);
        expect(sortedNames).toEqual(['cont1', 'cont3']);
    });

    it('getTreeItem returns the element itself', () => {
        const item = new SubsystemTreeItem('Host');
        expect(provider.getTreeItem(item)).toBe(item);
    });

    it('refresh fires the event', () => {
        const spy = jest.fn();
        provider.onDidChangeTreeData(spy);
        provider.refresh();
        expect(spy).toHaveBeenCalledWith(undefined);
    });

    it('handles parsing error in getContainersData gracefully', async () => {
        containersManagerMock.getContainersData.mockResolvedValueOnce([]);
        const ambientGroup = new SubsystemTreeItem('Ambient');
        const children = await provider.getChildren(ambientGroup);
        expect(children).toEqual([]);
    });

    it('returns empty array when board is not reachable', async () => {
        containersManagerMock.getBoardState.mockResolvedValueOnce({ isReachable: false, hasContainerRuntime: true });
        const rootChildren = await provider.getChildren();
        expect(rootChildren.length).toEqual(1);
        expect(rootChildren[0].label).toBe('No board found');
    });

    it('returns empty array when container runtime is not found', async () => {
        containersManagerMock.getBoardState.mockResolvedValueOnce({ isReachable: true, hasContainerRuntime: false });
        const rootChildren = await provider.getChildren();
        expect(rootChildren.length).toEqual(1);
        expect(rootChildren[0].label).toBe('No container runtime found');
    });
});
