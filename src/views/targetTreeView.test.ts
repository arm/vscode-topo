import { TargetTreeView } from './targetTreeView';
import { TargetContainerTreeItem } from '../targetTreeView/targetContainerTreeItem';
import { TargetSubsystemTreeItem } from '../targetTreeView/targetSubsystemTreeItem';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import * as vscode from 'vscode';
import * as manifest from '../manifest';
import { ContainersManager } from '../target/containersManager';
import { TargetState, ContainerItem, TargetDescription } from '../util/types';
import { mock, MockProxy } from 'vitest-mock-extended';
import { TargetStore } from '../target/targetStore';
import { HealthCheckDependencyGroupTreeItem } from '../treeItems/healthCheckDependencyGroupTreeItem';
import { TargetSubsystemGroupTreeItem } from '../targetTreeView/targetSubsystemGroupTreeItem';
import { HealthCheckDependency, HealthCheckResult } from '../topoCliSchema';
import { TargetDescriptionStore } from '../target/targetDescriptionStore';

describe('TargetTreeView', () => {
    let view: TargetTreeView;
    let containersManagerMock: MockProxy<ContainersManager>;
    let targetStoreMock: MockProxy<TargetStore>;
    let targetDescriptionStoreMock: MockProxy<TargetDescriptionStore>;
    const target = 'user@topo.local';
    const targetDescription: TargetDescription = {
        hostProcessors: [],
        remoteProcessors: [{ name: 'imx-rproc' }, { name: 'other-rproc' }],
    };
    const targetHealth: HealthCheckResult['target'] = {
        isLocalhost: false,
        connectivity: {
            name: 'Connectivity',
            status: 'ok',
            value: 'ok',
        },
        dependencies: [
            {
                name: 'Podman',
                status: 'ok',
                value: 'present',
            },
        ],
        subsystemDriver: {
            name: 'SubsystemDriver',
            status: 'ok',
            value: 'ready',
        },
    };

    const mockContainers: ContainerItem[] = [
        {
            id: 'id1',
            name: 'cont1',
            image: 'img1',
            state: 'running',
            status: 'Up 4 days',
            labels: 'foo=bar',
            runningFor: '1h',
            runtime: manifest.TARGET_REMOTEPROC_RUNTIME,
            annotations: {
                'remoteproc.name': 'imx-rproc',
            },
            createdAt: '',
            ports: {},
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
            runtime: manifest.TARGET_HOST_RUNTIME,
            annotations: {},
            createdAt: '',
            ports: {},
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
            runtime: manifest.TARGET_REMOTEPROC_RUNTIME,
            annotations: {
                'remoteproc.name': 'imx-rproc',
            },
            createdAt: '',
            ports: {},
            target,
        },
    ];
    const onChangedEmitter = new vscode.EventEmitter<void>();
    const onDataUpdateEmitter = new vscode.EventEmitter<void>();

    beforeEach(() => {
        const targetState: TargetState = {
            health: targetHealth,
            status: 'connected',
        };

        containersManagerMock = mock<ContainersManager>();
        containersManagerMock.getContainersData.mockResolvedValue(
            mockContainers,
        );
        containersManagerMock.getTargetState.mockResolvedValue(targetState);
        containersManagerMock.onDataUpdate.mockImplementation(
            onDataUpdateEmitter.event,
        );

        targetStoreMock = mock<TargetStore>();
        targetStoreMock.getSelectedTarget.mockReturnValue(target);
        targetDescriptionStoreMock = mock<TargetDescriptionStore>();
        targetDescriptionStoreMock.getDescription.mockResolvedValue(
            targetDescription,
        );
        targetStoreMock.onChanged.mockImplementation(onChangedEmitter.event);
        view = new TargetTreeView(
            containersManagerMock,
            targetStoreMock,
            targetDescriptionStoreMock,
        );
        vi.clearAllTimers();
        vi.clearAllMocks();
    });

    describe('getChildren', () => {
        it('returns Target at root and Dependencies/Subsystems as its children', async () => {
            targetStoreMock.getTargets.mockReturnValue([target]);
            containersManagerMock.getTargetStateSnapshot.mockReturnValue({
                health: undefined,
                status: 'disconnected',
            });
            containersManagerMock.getTargetState.mockResolvedValue({
                health: targetHealth,
                status: 'connected',
            });

            const rootChildren = await view.getChildren();
            const targetChildren = await view.getChildren(rootChildren[0]);

            expect(targetChildren).toHaveLength(2);
            expect(targetChildren[0]).toBeInstanceOf(
                HealthCheckDependencyGroupTreeItem,
            );
            expect(targetChildren[1]).toBeInstanceOf(
                TargetSubsystemGroupTreeItem,
            );
            expect(targetChildren[0].label).toBe('Dependencies');
            expect(targetChildren[1].label).toBe('Subsystems');
        });

        it('returns dependency items for Dependencies group', async () => {
            const subsystemDriverHealth = mock<HealthCheckDependency>({
                name: 'rproc-driver',
                status: 'ok',
            });
            const dependencies = [
                mock<HealthCheckDependency>({
                    name: 'Container Engine',
                    status: 'ok',
                }),
                mock<HealthCheckDependency>({
                    name: 'Some Dependency',
                    status: 'ok',
                }),
            ];
            const targetState = mock<TargetState>({
                status: 'connected',
                health: {
                    dependencies: dependencies,
                    subsystemDriver: subsystemDriverHealth,
                },
            });
            containersManagerMock.getTargetState.mockResolvedValue(targetState);
            targetStoreMock.getTargets.mockReturnValue([target]);
            containersManagerMock.getTargetStateSnapshot.mockReturnValue(
                targetState,
            );
            const rootChildren = await view.getChildren();
            const targetChildren = await view.getChildren(rootChildren[0]);
            const dependenciesGroup = targetChildren.find(
                (v) => v instanceof HealthCheckDependencyGroupTreeItem,
            );

            const got = await view.getChildren(dependenciesGroup);

            expect(got.map((item) => item.label)).toEqual([
                dependencies[0].name,
                subsystemDriverHealth.name,
                dependencies[1].name,
            ]);
        });

        it('marks selected target as disconnected when health is undefined', async () => {
            targetStoreMock.getTargets.mockReturnValue([target]);
            targetStoreMock.getSelectedTarget.mockReturnValue(target);
            containersManagerMock.getTargetStateSnapshot.mockReturnValue({
                health: undefined,
                status: 'disconnected',
            });

            const rootChildren = await view.getChildren();

            expect(rootChildren).toHaveLength(1);
            const targetItem = rootChildren[0] as TargetTreeItem;
            expect(targetItem.contextValue).toContain('Target');
            expect(targetItem.contextValue).toContain('Selected');
            expect(targetItem.contextValue).not.toContain('Connected');
            expect(targetItem.collapsibleState).toBe(
                vscode.TreeItemCollapsibleState.None,
            );
        });

        it('returns containers for Host and remoteproc groups', async () => {
            const hostGroup = new TargetSubsystemTreeItem('Host', target);
            const hostChildren = await view.getChildren(hostGroup);
            const remoteprocGroup = new TargetSubsystemTreeItem(
                'imx-rproc',
                target,
            );
            const otherRprocGroup = new TargetSubsystemTreeItem(
                'other-rproc',
                target,
            );

            const imxRprocChildren = await view.getChildren(remoteprocGroup);
            const otherRprocChildren = await view.getChildren(otherRprocGroup);

            expect(hostChildren).toHaveLength(1);
            expect(hostChildren[0]).toBeInstanceOf(TargetContainerTreeItem);
            expect((hostChildren[0] as TargetContainerTreeItem).name).toBe(
                'cont2',
            );
            expect(imxRprocChildren).toHaveLength(2);
            expect(imxRprocChildren[0]).toBeInstanceOf(TargetContainerTreeItem);
            expect(
                imxRprocChildren.map(
                    (c) => (c as TargetContainerTreeItem).name,
                ),
            ).toEqual(expect.arrayContaining(['cont1', 'cont3']));
            expect(otherRprocChildren).toHaveLength(0);
        });

        it('handles parsing error in getContainersData gracefully', async () => {
            containersManagerMock.getContainersData.mockResolvedValueOnce([]);
            const remoteprocGroup = new TargetSubsystemTreeItem(
                'imx-rproc',
                target,
            );

            const children = await view.getChildren(remoteprocGroup);

            expect(children).toEqual([]);
        });

        it('returns empty array when there are no targets', async () => {
            targetStoreMock.getTargets.mockReturnValue([]);
            containersManagerMock.getTargetState.mockResolvedValueOnce({
                health: undefined,
                status: 'disconnected',
            });

            const rootChildren = await view.getChildren();

            expect(rootChildren.length).toEqual(0);
        });
    });

    describe('getTreeItem', () => {
        it('getTreeItem returns the element itself', () => {
            const item = new TargetSubsystemTreeItem('Host', target);

            const treeItem = view.getTreeItem(item);

            expect(treeItem).toBe(item);
        });
    });
});
