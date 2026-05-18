import { TargetTreeDataProvider } from './targetTreeDataProvider';
import { TargetContainerTreeItem } from './targetContainerTreeItem';
import { TargetSubsystemTreeItem } from './targetSubsystemTreeItem';
import { TargetTreeItem } from './targetTreeItem';
import * as vscode from 'vscode';
import * as manifest from '../manifest';
import { ContainersManager } from '../target/containersManager';
import { TargetState, ContainerItem, TargetDescription } from '../util/types';
import { mock, MockProxy } from 'jest-mock-extended';
import { TargetStore } from '../target/targetStore';
import { HealthCheckDependencyGroupTreeItem } from '../treeItems/healthCheckDependencyGroupTreeItem';
import { TargetSubsystemGroupTreeItem } from './targetSubsystemGroupTreeItem';
import { HealthCheckDependency, HealthCheckResult } from '../topoCliSchema';
import { TargetDescriptionStore } from '../target/targetDescriptionStore';
import { refreshTargetStateCommand } from '../refreshCommands';

jest.mock('../util/logger');

async function executeCommand(command: string, ...args: unknown[]) {
    const calls = jest.mocked(vscode.commands.registerCommand).mock.calls;
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
    let context: MockProxy<vscode.ExtensionContext>;
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
    beforeEach(() => {
        const targetState: TargetState = {
            health: targetHealth,
            status: 'connected',
        };
        context = mock<vscode.ExtensionContext>({ subscriptions: [] });

        containersManagerMock = mock<ContainersManager>();
        containersManagerMock.getContainersData.mockResolvedValue(
            mockContainers,
        );
        containersManagerMock.getTargetState.mockResolvedValue(targetState);

        targetStoreMock = mock<TargetStore>();
        targetStoreMock.getSelectedTarget.mockReturnValue(target);
        targetDescriptionStoreMock = mock<TargetDescriptionStore>();
        targetDescriptionStoreMock.getDescription.mockResolvedValue(
            targetDescription,
        );
        provider = new TargetTreeDataProvider(
            context,
            containersManagerMock,
            targetStoreMock,
            targetDescriptionStoreMock,
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
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
                TargetTreeDataProvider.inspectTargetHealthCommand,
                expect.any(Function),
            );
            expect(
                vscode.workspace.registerTextDocumentContentProvider,
            ).toHaveBeenCalledWith(
                TargetTreeDataProvider.inspectTargetHealthScheme,
                expect.any(Object),
            );
            expect(context.subscriptions.length).toBeGreaterThan(0);
        });
    });

    describe('getChildren', () => {
        it('returns Target at root and Dependencies/Subsystems as its children', async () => {
            targetStoreMock.getTargets.mockReturnValue([target]);
            containersManagerMock.getTargetState.mockResolvedValue({
                health: targetHealth,
                status: 'connected',
            });

            const rootChildren = await provider.getChildren();
            const targetChildren = await provider.getChildren(rootChildren[0]);

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
            const rootChildren = await provider.getChildren();
            const targetChildren = await provider.getChildren(rootChildren[0]);
            const dependenciesGroup = targetChildren.find(
                (v) => v instanceof HealthCheckDependencyGroupTreeItem,
            );

            const got = await provider.getChildren(dependenciesGroup);

            expect(got.map((item) => item.label)).toEqual([
                dependencies[0].name,
                subsystemDriverHealth.name,
                dependencies[1].name,
            ]);
        });

        it('marks selected target as disconnected when health is undefined', async () => {
            targetStoreMock.getTargets.mockReturnValue([target]);
            targetStoreMock.getSelectedTarget.mockReturnValue(target);
            containersManagerMock.getTargetState.mockResolvedValue({
                health: undefined,
                status: 'disconnected',
            });

            const rootChildren = await provider.getChildren();

            expect(rootChildren).toHaveLength(1);
            const targetItem = rootChildren[0] as TargetTreeItem;
            expect(targetItem.contextValue).toContain('Target');
            expect(targetItem.contextValue).toContain('Selected');
            expect(targetItem.contextValue).not.toContain('Connected');
            expect(targetItem.collapsibleState).toBe(
                vscode.TreeItemCollapsibleState.None,
            );
        });

        it('does not mark non-selected targets as connected', async () => {
            const otherTarget = 'user@other.local';
            targetStoreMock.getTargets.mockReturnValue([target, otherTarget]);
            targetStoreMock.getSelectedTarget.mockReturnValue(target);
            containersManagerMock.getTargetState.mockResolvedValue({
                health: targetHealth,
                status: 'connected',
            });

            const rootChildren = await provider.getChildren();

            const otherTargetItem = rootChildren.find(
                (item): item is TargetTreeItem =>
                    item instanceof TargetTreeItem &&
                    item.target === otherTarget,
            );
            expect(otherTargetItem).toBeDefined();
            expect(otherTargetItem!.status).toBe('disconnected');
            expect(otherTargetItem!.contextValue).not.toContain('Connected');
        });

        it('returns containers for Host and remoteproc groups', async () => {
            const hostGroup = new TargetSubsystemTreeItem('Host', target);
            const hostChildren = await provider.getChildren(hostGroup);
            const remoteprocGroup = new TargetSubsystemTreeItem(
                'imx-rproc',
                target,
            );
            const otherRprocGroup = new TargetSubsystemTreeItem(
                'other-rproc',
                target,
            );

            const imxRprocChildren =
                await provider.getChildren(remoteprocGroup);
            const otherRprocChildren =
                await provider.getChildren(otherRprocGroup);

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

            const children = await provider.getChildren(remoteprocGroup);

            expect(children).toEqual([]);
        });

        it('returns empty array when there are no targets', async () => {
            targetStoreMock.getTargets.mockReturnValue([]);
            containersManagerMock.getTargetState.mockResolvedValueOnce({
                health: undefined,
                status: 'disconnected',
            });

            const rootChildren = await provider.getChildren();

            expect(rootChildren.length).toEqual(0);
        });
    });

    describe('getTreeItem', () => {
        it('getTreeItem returns the element itself', () => {
            const item = new TargetSubsystemTreeItem('Host', target);

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
        it('invokes targetStore.setSelected when select command is executed with a target item', async () => {
            await provider.activate();
            const targetItem = new TargetTreeItem(target, true, 'connected');

            await executeCommand(
                TargetTreeDataProvider.selectTargetCommand,
                targetItem,
            );

            expect(targetStoreMock.setSelected).toHaveBeenCalledWith(target);
        });

        it('does not call setSelected when select command is executed with a non-target item', async () => {
            await provider.activate();

            await executeCommand(TargetTreeDataProvider.selectTargetCommand);

            expect(targetStoreMock.setSelected).not.toHaveBeenCalled();
        });
    });

    describe('removeTarget command', () => {
        it('invokes targetStore.deleteTarget when remove command is executed with a target item', async () => {
            const targetItem = new TargetTreeItem(target, true, 'connected');
            targetStoreMock.getTargets.mockReturnValue([target]);
            await provider.activate();

            await executeCommand(
                TargetTreeDataProvider.removeTargetCommand,
                targetItem,
            );

            expect(targetStoreMock.deleteTarget).toHaveBeenCalledWith(target);
        });

        it('refreshes target state after removing selected target', async () => {
            const targetItem = new TargetTreeItem(target, true, 'connected');
            targetStoreMock.getSelectedTarget.mockResolvedValue(target);
            await provider.activate();

            await executeCommand(
                TargetTreeDataProvider.removeTargetCommand,
                targetItem,
            );

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                refreshTargetStateCommand,
            );
        });

        it('does not refresh target state after removing a non-selected target', async () => {
            const removedTarget = 'user@removed.local';
            const targetItem = new TargetTreeItem(
                removedTarget,
                false,
                'disconnected',
            );
            targetStoreMock.getSelectedTarget.mockResolvedValue(target);
            await provider.activate();

            await executeCommand(
                TargetTreeDataProvider.removeTargetCommand,
                targetItem,
            );

            expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith(
                refreshTargetStateCommand,
            );
        });

        it('does not call deleteTarget when remove command is executed with a non-target item', async () => {
            await provider.activate();

            await executeCommand(TargetTreeDataProvider.removeTargetCommand);

            expect(targetStoreMock.deleteTarget).not.toHaveBeenCalled();
        });

        it('shows an error when deleteTarget fails', async () => {
            const targetItem = new TargetTreeItem(target, true, 'connected');
            targetStoreMock.deleteTarget.mockRejectedValue(
                new Error('Target not found'),
            );
            await provider.activate();

            await executeCommand(
                TargetTreeDataProvider.removeTargetCommand,
                targetItem,
            );

            expect(vscode.window.showErrorMessage).toHaveBeenCalled();
        });
    });

    describe('inspectHealth command', () => {
        it('opens a readonly health JSON virtual document for selected target', async () => {
            await provider.activate();
            const targetItem = new TargetTreeItem(target, true, 'connected');
            const textDocument = mock<vscode.TextDocument>();
            jest.mocked(
                vscode.workspace.openTextDocument,
            ).mockResolvedValueOnce(textDocument);

            await executeCommand(
                TargetTreeDataProvider.inspectTargetHealthCommand,
                targetItem,
            );

            const providerRegistration = jest.mocked(
                vscode.workspace.registerTextDocumentContentProvider,
            ).mock.calls[0];
            const contentProvider = providerRegistration[1];
            const uri = jest.mocked(vscode.workspace.openTextDocument).mock
                .calls[0][0];
            const content = await Promise.resolve(
                contentProvider.provideTextDocumentContent(
                    uri as vscode.Uri,
                    mock<vscode.CancellationToken>(),
                ),
            );

            expect((uri as vscode.Uri).scheme).toBe(
                TargetTreeDataProvider.inspectTargetHealthScheme,
            );
            expect(content).toBeDefined();
            expect(JSON.parse(content!)).toEqual(targetHealth);
            expect(vscode.window.showTextDocument).toHaveBeenCalledWith(
                textDocument,
                { preview: true },
            );
        });

        it('does not open health document for non-selected target', async () => {
            await provider.activate();
            const targetItem = new TargetTreeItem(
                target,
                false,
                'disconnected',
            );

            await executeCommand(
                TargetTreeDataProvider.inspectTargetHealthCommand,
                targetItem,
            );

            expect(vscode.workspace.openTextDocument).not.toHaveBeenCalled();
            expect(vscode.window.showTextDocument).not.toHaveBeenCalled();
        });
    });
});
