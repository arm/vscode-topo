import * as vscode from 'vscode';
import { TargetTreeView } from './targetTreeView';
import { TargetContainerTreeItem } from '../targetTreeView/targetContainerTreeItem';
import { TargetSubsystemTreeItem } from '../targetTreeView/targetSubsystemTreeItem';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import * as manifest from '../manifest';
import { ContainerItem, TargetDescription } from '../util/types';
import { mock, MockProxy } from 'vitest-mock-extended';
import { HealthCheckDependencyGroupTreeItem } from '../treeItems/healthCheckDependencyGroupTreeItem';
import { TargetSubsystemGroupTreeItem } from '../targetTreeView/targetSubsystemGroupTreeItem';
import {
    HealthCheckDependency,
    TargetHealthCheckResult,
} from '../topoCliSchema';
import { TargetDescriptionStore } from '../target/targetDescriptionStore';
import { TargetModel } from '../models/targetModel';
import { SelectedTargetModel } from '../models/selectedTargetModel';
import { errored, loaded } from '../util/loadable';
import { ErrorTreeItem } from '../treeItems/errorTreeItem';

describe('TargetTreeView', () => {
    let view: TargetTreeView;
    let selectedTargetModel: SelectedTargetModel;
    let targetModel: TargetModel;
    let targetDescriptionStoreMock: MockProxy<TargetDescriptionStore>;
    const target = 'user@topo.local';
    const targetDescription: TargetDescription = {
        hostProcessors: [],
        remoteProcessors: [{ name: 'imx-rproc' }, { name: 'other-rproc' }],
    };
    const targetHealth: TargetHealthCheckResult = {
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

    beforeEach(() => {
        targetModel = new TargetModel();
        targetModel.setTargets([target]);
        targetModel.setSelected(target);
        selectedTargetModel = new SelectedTargetModel();
        selectedTargetModel.setHealth(loaded(targetHealth));
        selectedTargetModel.setContainers(loaded(mockContainers));
        targetDescriptionStoreMock = mock<TargetDescriptionStore>();
        targetDescriptionStoreMock.getDescription.mockResolvedValue(
            targetDescription,
        );
        view = new TargetTreeView(
            selectedTargetModel,
            targetModel,
            targetDescriptionStoreMock,
        );
        vi.clearAllTimers();
        vi.clearAllMocks();
    });

    describe('getChildren', () => {
        it('returns Target at root and Dependencies/Subsystems as its children', async () => {
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
            expect(
                targetDescriptionStoreMock.getDescription,
            ).toHaveBeenCalledTimes(1);
        });

        it('returns dependency items for Dependencies group', async () => {
            const subsystemDriverHealth: HealthCheckDependency = {
                name: 'rproc-driver',
                status: 'ok',
                value: 'ready',
            };
            const dependencies: HealthCheckDependency[] = [
                {
                    name: 'Container Engine',
                    status: 'ok',
                    value: 'present',
                },
                {
                    name: 'Some Dependency',
                    status: 'ok',
                    value: 'present',
                },
            ];
            selectedTargetModel.setHealth(
                loaded({
                    ...targetHealth,
                    dependencies,
                    subsystemDriver: subsystemDriverHealth,
                }),
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

        it('shows cleared selected target data as connected with no dependencies', async () => {
            selectedTargetModel.clear();

            const rootChildren = await view.getChildren();

            expect(rootChildren).toHaveLength(1);
            const targetItem = rootChildren[0] as TargetTreeItem;
            expect(targetItem.contextValue).toContain('Target');
            expect(targetItem.contextValue).toContain('Selected');
            expect(targetItem.visibleDependencies).toEqual([]);
            expect(targetItem.collapsibleState).toBe(
                vscode.TreeItemCollapsibleState.None,
            );
        });

        it('shows health diagnostics on selected target when health has an error', async () => {
            const diagnostics = '"ssh" not found on remote target\'s $PATH';
            selectedTargetModel.setHealth(errored(diagnostics));

            const rootChildren = await view.getChildren();

            expect(rootChildren).toStrictEqual([
                expect.objectContaining({
                    label: target,
                    description: diagnostics,
                    tooltip: `${target}: ${diagnostics}`,
                }),
            ]);
        });

        it('does not show health diagnostics on unselected targets', async () => {
            const otherTarget = 'user@other.local';
            targetModel.setTargets([target, otherTarget]);
            targetModel.setSelected(otherTarget);
            selectedTargetModel.setHealth(errored('ssh connection failed'));

            const rootChildren = await view.getChildren();
            const unselectedTarget = rootChildren.find(
                (item) => item.label === target,
            );

            expect(unselectedTarget).toBeDefined();
            expect(unselectedTarget!.description).toBeUndefined();
        });

        it('marks target with executable dependency fixes as fixable', async () => {
            selectedTargetModel.setHealth(
                loaded({
                    ...targetHealth,
                    dependencies: [
                        {
                            name: 'Container Engine',
                            status: 'error',
                            value: 'missing',
                            fix: {
                                description: 'Install container engine',
                                command: 'topo install container-engine',
                            },
                        },
                    ],
                }),
            );

            const rootChildren = await view.getChildren();

            expect(rootChildren).toHaveLength(1);
            expect(rootChildren[0].contextValue).toContain(
                'HasFixableDependencies',
            );
        });

        it('marks target with executable subsystem driver fix as fixable when remote processors exist', async () => {
            selectedTargetModel.setHealth(
                loaded({
                    ...targetHealth,
                    subsystemDriver: {
                        name: 'SubsystemDriver',
                        status: 'error',
                        value: 'missing',
                        fix: {
                            description: 'Install subsystem driver',
                            command: 'topo install subsystem-driver',
                        },
                    },
                }),
            );

            const rootChildren = await view.getChildren();

            expect(rootChildren).toHaveLength(1);
            expect(rootChildren[0].contextValue).toContain(
                'HasFixableDependencies',
            );
        });

        it('does not mark target as fixable for hidden subsystem driver fixes', async () => {
            targetDescriptionStoreMock.getDescription.mockResolvedValue({
                hostProcessors: [],
                remoteProcessors: [],
            });
            selectedTargetModel.setHealth(
                loaded({
                    ...targetHealth,
                    subsystemDriver: {
                        name: 'SubsystemDriver',
                        status: 'error',
                        value: 'missing',
                        fix: {
                            description: 'Install subsystem driver',
                            command: 'topo install subsystem-driver',
                        },
                    },
                }),
            );

            const rootChildren = await view.getChildren();

            expect(rootChildren).toHaveLength(1);
            expect(rootChildren[0].contextValue).not.toContain(
                'HasFixableDependencies',
            );
        });

        it('does not mark target as fixable when no executable dependency fixes exist', async () => {
            selectedTargetModel.setHealth(
                loaded({
                    ...targetHealth,
                    dependencies: [
                        {
                            name: 'Container Engine',
                            status: 'error',
                            value: 'missing',
                            fix: {
                                description: 'Manual setup required',
                            },
                        },
                    ],
                }),
            );

            const rootChildren = await view.getChildren();

            expect(rootChildren).toHaveLength(1);
            expect(rootChildren[0].contextValue).not.toContain(
                'HasFixableDependencies',
            );
        });

        it('returns containers for Host and remoteproc groups', async () => {
            const rootChildren = await view.getChildren();
            const targetChildren = await view.getChildren(rootChildren[0]);
            const subsystemsGroup = targetChildren.find(
                (v) => v instanceof TargetSubsystemGroupTreeItem,
            );
            const subsystemItems = await view.getChildren(subsystemsGroup);
            const hostGroup = subsystemItems.find(
                (item) => item.label === 'Host',
            ) as TargetSubsystemTreeItem;
            const remoteprocGroup = subsystemItems.find(
                (item) => item.label === 'imx-rproc',
            ) as TargetSubsystemTreeItem;
            const otherRprocGroup = subsystemItems.find(
                (item) => item.label === 'other-rproc',
            ) as TargetSubsystemTreeItem;

            const hostChildren = await view.getChildren(hostGroup);
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
            ).toEqual(['cont1', 'cont3']);
            expect(otherRprocChildren).toHaveLength(0);
        });

        it('returns an error item when containers fail to load', async () => {
            selectedTargetModel.setContainers(
                errored('container parse failed'),
            );
            const rootChildren = await view.getChildren();
            const targetChildren = await view.getChildren(rootChildren[0]);
            const subsystemsGroup = targetChildren.find(
                (v) => v instanceof TargetSubsystemGroupTreeItem,
            );

            const got = await view.getChildren(subsystemsGroup);

            expect(got).toHaveLength(1);
            expect(got[0]).toBeInstanceOf(ErrorTreeItem);
            expect(got[0].label).toBe('Failed to load containers');
        });

        it('returns empty array when there are no targets', async () => {
            targetModel.setTargets([]);

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
