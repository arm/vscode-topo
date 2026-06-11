import * as vscode from 'vscode';
import { TargetTreeView } from './targetTreeView';
import { TargetContainerTreeItem } from '../targetTreeView/targetContainerTreeItem';
import { TargetProcessingDomainTreeItem } from '../targetTreeView/targetProcessingDomainTreeItem';
import * as manifest from '../manifest';
import { ContainerItem, TargetDescription } from '../util/types';
import { mock, MockProxy } from 'vitest-mock-extended';
import { HealthCheckDependencyGroupTreeItem } from '../treeItems/healthCheckDependencyGroupTreeItem';
import { TargetProcessingDomainGroupTreeItem } from '../targetTreeView/targetProcessingDomainGroupTreeItem';
import { IssueCheck, TargetHealthCheck } from '../topoCliSchema';
import { TargetDescriptionStore } from '../target/targetDescriptionStore';
import { TargetModel } from '../models/targetModel';
import { errored, loaded } from '../util/loadable';
import { ErrorTreeItem } from '../treeItems/errorTreeItem';
import { HealthCheckDependencyTreeItem } from '../treeItems/healthCheckDependencyTreeItem';

describe('TargetTreeView', () => {
    let view: TargetTreeView;
    let targetModel: TargetModel;
    let targetDescriptionStoreMock: MockProxy<TargetDescriptionStore>;
    let treeView: vscode.TreeView<vscode.TreeItem>;
    const target = 'user@topo.local';
    const targetDescription: TargetDescription = {
        hostProcessors: [],
        remoteProcessors: [{ name: 'imx-rproc' }, { name: 'other-rproc' }],
        totalMemoryKb: 1024,
    };
    const targetHealth: TargetHealthCheck = {
        destination: `ssh://${target}`,
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
        targetModel.setSelectedTargetHealth(loaded(targetHealth));
        targetModel.setSelectedTargetContainers(loaded(mockContainers));
        targetDescriptionStoreMock = mock<TargetDescriptionStore>();
        targetDescriptionStoreMock.getDescription.mockResolvedValue(
            targetDescription,
        );
        view = new TargetTreeView(targetModel, targetDescriptionStoreMock);
        treeView = vi.mocked(vscode.window.createTreeView).mock.results[0]
            .value;
        vi.clearAllTimers();
        vi.clearAllMocks();
    });

    describe('getChildren', () => {
        it('shows selected target in the view description', () => {
            expect(treeView.description).toBe(target);
        });

        it('returns Dependencies/Processing Domains at the root', async () => {
            const rootChildren = await view.getChildren();

            expect(rootChildren).toHaveLength(2);
            expect(rootChildren[0]).toBeInstanceOf(
                HealthCheckDependencyGroupTreeItem,
            );
            expect(rootChildren[1]).toBeInstanceOf(
                TargetProcessingDomainGroupTreeItem,
            );
            expect(rootChildren[0].label).toBe('Dependencies');
            expect(rootChildren[1].label).toBe('Processing Domains');
            expect(
                targetDescriptionStoreMock.getDescription,
            ).toHaveBeenCalledTimes(1);
        });

        it('returns dependency items for Dependencies group', async () => {
            const subsystemDriverHealth = mock<IssueCheck>({
                name: 'rproc-driver',
                status: 'ok',
            });
            const dependencies = [
                mock<IssueCheck>({
                    name: 'Container Engine',
                    status: 'ok',
                }),
                mock<IssueCheck>({
                    name: 'Some Dependency',
                    status: 'ok',
                }),
            ];
            targetModel.setSelectedTargetHealth(
                loaded({
                    ...targetHealth,
                    dependencies,
                    subsystemDriver: subsystemDriverHealth,
                }),
            );
            const rootChildren = await view.getChildren();
            const dependenciesGroup = rootChildren.find(
                (v) => v instanceof HealthCheckDependencyGroupTreeItem,
            );
            expect(dependenciesGroup).toBeDefined();

            const got = await view.getChildren(dependenciesGroup);

            expect(got.map((item) => item.label)).toEqual([
                dependencies[0].name,
                subsystemDriverHealth.name,
                dependencies[1].name,
            ]);
        });

        it('returns a connectivity item while selected target health is pending', async () => {
            targetModel.setSelectedTargetHealth(loaded(undefined));

            const rootChildren = await view.getChildren();

            expect(rootChildren).toHaveLength(1);
            expect(rootChildren[0]).toBeInstanceOf(
                HealthCheckDependencyTreeItem,
            );
            expect(rootChildren[0]).toMatchObject({
                label: 'Connectivity',
                description: 'Checking target connectivity',
                contextValue: 'Dependency Warning',
            });
            expect((rootChildren[0].iconPath as vscode.ThemeIcon).id).toBe(
                'loading~spin',
            );
            expect(
                targetDescriptionStoreMock.getDescription,
            ).not.toHaveBeenCalled();
        });

        it('returns a connectivity item when selected target has a connectivity error', async () => {
            const diagnostics = '"ssh" not found on remote target\'s $PATH';
            targetModel.setSelectedTargetHealth(
                loaded({
                    ...targetHealth,
                    connectivity: {
                        name: 'Connectivity',
                        status: 'error',
                        value: diagnostics,
                    },
                }),
            );

            const rootChildren = await view.getChildren();

            expect(rootChildren).toHaveLength(1);
            expect(rootChildren[0]).toBeInstanceOf(
                HealthCheckDependencyTreeItem,
            );
            expect(rootChildren[0]).toMatchObject({
                label: 'Connectivity',
                description: diagnostics,
                contextValue: 'Dependency Error',
            });
            expect(
                targetDescriptionStoreMock.getDescription,
            ).not.toHaveBeenCalled();
        });

        it('updates the view description when the selected target changes', async () => {
            const otherTarget = 'user@other.local';
            targetModel.setTargets([target, otherTarget]);
            targetModel.setSelected(otherTarget);
            targetModel.setSelectedTargetHealth(
                errored('ssh connection failed'),
            );

            const rootChildren = await view.getChildren();

            expect(treeView.description).toBe(otherTarget);
            expect(rootChildren).toHaveLength(1);
            expect(rootChildren[0]).toMatchObject({
                label: 'Connectivity',
                description: 'ssh connection failed',
            });
            expect(
                targetDescriptionStoreMock.getDescription,
            ).not.toHaveBeenCalled();
        });

        it('returns containers for Primary OS and remote processor groups', async () => {
            const rootChildren = await view.getChildren();
            const processingDomainsGroup = rootChildren.find(
                (v) => v instanceof TargetProcessingDomainGroupTreeItem,
            );
            const processingDomainItems = await view.getChildren(
                processingDomainsGroup,
            );
            const primaryOsGroup = processingDomainItems.find(
                (item) => item.label === 'Primary OS',
            ) as TargetProcessingDomainTreeItem;
            const remoteprocGroup = processingDomainItems.find(
                (item) => item.label === 'imx-rproc',
            ) as TargetProcessingDomainTreeItem;
            const otherRprocGroup = processingDomainItems.find(
                (item) => item.label === 'other-rproc',
            ) as TargetProcessingDomainTreeItem;

            const primaryOsChildren = await view.getChildren(primaryOsGroup);
            const imxRprocChildren = await view.getChildren(remoteprocGroup);
            const otherRprocChildren = await view.getChildren(otherRprocGroup);

            expect(primaryOsChildren).toHaveLength(1);
            expect(primaryOsChildren[0]).toBeInstanceOf(
                TargetContainerTreeItem,
            );
            expect((primaryOsChildren[0] as TargetContainerTreeItem).name).toBe(
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
            targetModel.setSelectedTargetContainers(
                errored('container parse failed'),
            );
            const rootChildren = await view.getChildren();
            const processingDomainsGroup = rootChildren.find(
                (v) => v instanceof TargetProcessingDomainGroupTreeItem,
            );

            const got = await view.getChildren(processingDomainsGroup);

            expect(got).toHaveLength(1);
            expect(got[0]).toBeInstanceOf(ErrorTreeItem);
            expect(got[0].label).toBe('Failed to load containers');
        });

        it('returns empty array when no target is selected', async () => {
            targetModel.setTargets([]);
            targetModel.setSelected(undefined);

            const rootChildren = await view.getChildren();

            expect(rootChildren.length).toEqual(0);
            expect(treeView.description).toBeUndefined();
            expect(
                targetDescriptionStoreMock.getDescription,
            ).not.toHaveBeenCalled();
        });
    });

    describe('getTreeItem', () => {
        it('getTreeItem returns the element itself', () => {
            const item = new TargetProcessingDomainTreeItem(
                'PrimaryOS',
                target,
            );

            const treeItem = view.getTreeItem(item);

            expect(treeItem).toBe(item);
        });
    });
});
