import * as vscode from 'vscode';
import { TargetTreeView } from './targetTreeView';
import { TargetContainerTreeItem } from '../targetTreeView/targetContainerTreeItem';
import { TargetProcessingDomainTreeItem } from '../targetTreeView/targetProcessingDomainTreeItem';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import * as manifest from '../manifest';
import { ContainerItem, TargetDescription } from '../util/types';
import { mock } from 'vitest-mock-extended';
import { HealthCheckDependencyGroupTreeItem } from '../treeItems/healthCheckDependencyGroupTreeItem';
import { TargetProcessingDomainGroupTreeItem } from '../targetTreeView/targetProcessingDomainGroupTreeItem';
import { IssueCheck, TargetHealthCheck } from '../topoCliSchema';
import { TargetModel } from '../models/targetModel';
import { errored, loaded } from '../util/loadable';
import { ErrorTreeItem } from '../treeItems/errorTreeItem';

describe('TargetTreeView', () => {
    let view: TargetTreeView;
    let targetModel: TargetModel;
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
        targetModel.setSelectedTargetDescription(loaded(targetDescription));
        view = new TargetTreeView(targetModel);
        vi.clearAllTimers();
        vi.clearAllMocks();
    });

    describe('getChildren', () => {
        it('returns Target at root and Dependencies/Processing Domains as its children', () => {
            const rootChildren = view.getChildren();
            const targetChildren = view.getChildren(rootChildren[0]);

            expect(targetChildren).toHaveLength(2);
            expect(targetChildren[0]).toBeInstanceOf(
                HealthCheckDependencyGroupTreeItem,
            );
            expect(targetChildren[1]).toBeInstanceOf(
                TargetProcessingDomainGroupTreeItem,
            );
            expect(targetChildren[0].label).toBe('Dependencies');
            expect(targetChildren[1].label).toBe('Processing Domains');
        });

        it('returns dependency items for Dependencies group', () => {
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
            const rootChildren = view.getChildren();
            const targetChildren = view.getChildren(rootChildren[0]);
            const dependenciesGroup = targetChildren.find(
                (v) => v instanceof HealthCheckDependencyGroupTreeItem,
            );
            expect(dependenciesGroup).toBeDefined();

            const got = view.getChildren(dependenciesGroup);

            expect(got.map((item) => item.label)).toEqual([
                dependencies[0].name,
                subsystemDriverHealth.name,
                dependencies[1].name,
            ]);
        });

        it('sets disconnected context and tree collapsible state for target with pending health', () => {
            targetModel.setSelectedTargetHealth(loaded(undefined));

            const rootChildren = view.getChildren();

            expect(rootChildren).toHaveLength(1);
            const targetItem = rootChildren[0] as TargetTreeItem;
            expect(targetItem.contextValue).toContain('Target');
            expect(targetItem.collapsibleState).toBe(
                vscode.TreeItemCollapsibleState.None,
            );
        });

        it('shows health diagnostics on selected target when health has an error', () => {
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

            const rootChildren = view.getChildren();

            expect(rootChildren).toStrictEqual([
                expect.objectContaining({
                    label: target,
                    description: diagnostics,
                    tooltip: `${target}: ${diagnostics}`,
                }),
            ]);
        });

        it('only returns the selected target at the root', () => {
            const otherTarget = 'user@other.local';
            targetModel.setTargets([target, otherTarget]);
            targetModel.setSelected(otherTarget);
            targetModel.setSelectedTargetHealth(
                errored('ssh connection failed'),
            );

            const rootChildren = view.getChildren();

            expect(rootChildren).toHaveLength(1);
            expect(rootChildren[0]).toMatchObject({
                label: otherTarget,
                description: 'ssh connection failed',
                tooltip: `${otherTarget}: ssh connection failed`,
            });
        });

        it('marks target with executable subsystem driver fix as fixable when remote processors exist', async () => {
            targetModel.setSelectedTargetHealth(
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

            const rootChildren = view.getChildren();

            expect(rootChildren).toHaveLength(1);
            expect(rootChildren[0].contextValue).toContain('HasFixableIssues');
        });

        it('returns containers for Primary OS and remote processor groups', () => {
            const rootChildren = view.getChildren();
            const targetChildren = view.getChildren(rootChildren[0]);
            const processingDomainsGroup = targetChildren.find(
                (v) => v instanceof TargetProcessingDomainGroupTreeItem,
            );
            const processingDomainItems = view.getChildren(
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

            const primaryOsChildren = view.getChildren(primaryOsGroup);
            const imxRprocChildren = view.getChildren(remoteprocGroup);
            const otherRprocChildren = view.getChildren(otherRprocGroup);

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

        it('returns an error item when containers fail to load', () => {
            targetModel.setSelectedTargetContainers(
                errored('container parse failed'),
            );
            const rootChildren = view.getChildren();
            const targetChildren = view.getChildren(rootChildren[0]);
            const processingDomainsGroup = targetChildren.find(
                (v) => v instanceof TargetProcessingDomainGroupTreeItem,
            );

            const got = view.getChildren(processingDomainsGroup);

            expect(got).toHaveLength(1);
            expect(got[0]).toBeInstanceOf(ErrorTreeItem);
            expect(got[0].label).toBe('Failed to load containers');
        });

        it('returns empty array when no target is selected', () => {
            targetModel.setTargets([]);
            targetModel.setSelected(undefined);

            const rootChildren = view.getChildren();

            expect(rootChildren.length).toEqual(0);
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
