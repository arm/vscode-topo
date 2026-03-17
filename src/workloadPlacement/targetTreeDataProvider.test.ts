import { TargetTreeDataProvider } from './targetTreeDataProvider';
import { TargetTreeContainerItem } from './targetTreeContainerItem';
import { TargetTreeSubsystemItem } from './targetTreeSubsystemItem';
import { TargetTreeTargetItem } from './targetTreeTargetItem';
import * as vscode from 'vscode';
import * as manifest from '../manifest';
import { ContainersManager } from './containersManager';
import { TargetState, ContainerItem, TargetItem } from '../util/types';
import { mock, MockProxy } from 'jest-mock-extended';
import { TargetStore } from './targetStore';
import { TargetTreeDependencyGroupItem } from './targetTreeDependencyGroupItem';
import { TargetTreeSubsystemGroupItem } from './targetTreeSubsystemGroupItem';
import { HealthCheckDependency, HealthCheckResult } from '../topoCliSchema';

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
    const target: TargetItem = {
        id: 'topo',
        ssh: 'user@topo.local',
        user: 'user',
        host: 'topo.local',
        targetDescription: {
            hostProcessor: [],
            remoteprocCPU: [{ name: 'imx-rproc' }, { name: 'other-rproc' }],
        },
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
            runtime: manifest.TARGET_HOST_RUNTIME,
            annotations: {},
            createdAt: '',
            ports: {},
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
            runtime: manifest.TARGET_REMOTEPROC_RUNTIME,
            annotations: {
                'remoteproc.name': 'imx-rproc',
            },
            createdAt: '',
            ports: {},
            cpuUsage: '0.0%',
            memUsage: '0B / 1GiB',
            target,
        },
    ];
    const onChangedEmitter = new vscode.EventEmitter<void>();
    const onDataUpdateEmitter = new vscode.EventEmitter<void>();

    beforeEach(() => {
        const targetState: TargetState = {
            health: targetHealth,
            targetId: target.id,
        };
        context = mock<vscode.ExtensionContext>({ subscriptions: [] });

        containersManagerMock = mock<ContainersManager>();
        containersManagerMock.getContainersData.mockResolvedValue(
            mockContainers,
        );
        containersManagerMock.getTargetState.mockResolvedValue(targetState);
        containersManagerMock.onDataUpdate.mockImplementation(
            onDataUpdateEmitter.event,
        );

        targetStoreMock = mock<TargetStore>();
        targetStoreMock.getSelectedTarget.mockResolvedValue(target);
        targetStoreMock.onChanged.mockImplementation(onChangedEmitter.event);
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

            const rootChildren = await provider.getChildren();
            const targetChildren = await provider.getChildren(rootChildren[0]);

            expect(targetChildren).toHaveLength(2);
            expect(targetChildren[0]).toBeInstanceOf(
                TargetTreeDependencyGroupItem,
            );
            expect(targetChildren[1]).toBeInstanceOf(
                TargetTreeSubsystemGroupItem,
            );
            expect(targetChildren[0].label).toBe('Dependencies');
            expect(targetChildren[1].label).toBe('Subsystems');
        });

        it('returns dependency items for Dependencies group', async () => {
            const subsystemDriverHealth = mock<HealthCheckDependency>({
                name: 'rproc-driver',
            });
            const dependencies = [
                mock<HealthCheckDependency>({
                    name: 'Container Engine',
                }),
                mock<HealthCheckDependency>({
                    name: 'Some Dependency',
                }),
            ];
            const targetState = mock<TargetState>({
                targetId: target.id,
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
                (v) => v instanceof TargetTreeDependencyGroupItem,
            );

            const got = await provider.getChildren(dependenciesGroup);

            expect(got.map((item) => item.label)).toEqual([
                dependencies[0].name,
                subsystemDriverHealth.name,
                dependencies[1].name,
            ]);
        });

        it('marks selected target as not ready when health is undefined', async () => {
            targetStoreMock.getTargets.mockReturnValue([target]);
            targetStoreMock.getSelectedTarget.mockResolvedValue(target);
            containersManagerMock.getTargetState.mockResolvedValueOnce({
                health: undefined,
                targetId: target.id,
            });

            const rootChildren = await provider.getChildren();

            expect(rootChildren).toHaveLength(1);
            const targetItem = rootChildren[0] as TargetTreeTargetItem;
            expect(targetItem.contextValue).toContain('Target');
            expect(targetItem.contextValue).toContain('Selected');
            expect(targetItem.contextValue).toContain('ConnectionReady');
            expect(targetItem.contextValue).not.toContain('TargetReady');
            expect(targetItem.collapsibleState).toBe(
                vscode.TreeItemCollapsibleState.None,
            );
        });

        it('returns containers for Host and remoteproc groups', async () => {
            const hostGroup = new TargetTreeSubsystemItem('Host');
            const hostChildren = await provider.getChildren(hostGroup);
            const remoteprocGroup = new TargetTreeSubsystemItem('imx-rproc');
            const otherRprocGroup = new TargetTreeSubsystemItem('other-rproc');

            const imxRprocChildren =
                await provider.getChildren(remoteprocGroup);
            const otherRprocChildren =
                await provider.getChildren(otherRprocGroup);

            expect(hostChildren).toHaveLength(1);
            expect(hostChildren[0]).toBeInstanceOf(TargetTreeContainerItem);
            expect((hostChildren[0] as TargetTreeContainerItem).name).toBe(
                'cont2',
            );
            expect(imxRprocChildren).toHaveLength(2);
            expect(imxRprocChildren[0]).toBeInstanceOf(TargetTreeContainerItem);
            expect(
                imxRprocChildren.map(
                    (c) => (c as TargetTreeContainerItem).name,
                ),
            ).toEqual(expect.arrayContaining(['cont1', 'cont3']));
            expect(otherRprocChildren).toHaveLength(0);
        });

        it('handles parsing error in getContainersData gracefully', async () => {
            containersManagerMock.getContainersData.mockResolvedValueOnce([]);
            const remoteprocGroup = new TargetTreeSubsystemItem('imx-rproc');

            const children = await provider.getChildren(remoteprocGroup);

            expect(children).toEqual([]);
        });

        it('returns empty array when there are no targets', async () => {
            targetStoreMock.getTargets.mockReturnValue([]);
            containersManagerMock.getTargetState.mockResolvedValueOnce({
                health: undefined,
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
        it('invokes targetStore.setSelected when select command is executed with a target item', async () => {
            await provider.activate();
            const targetItem = new TargetTreeTargetItem(
                target,
                true,
                true,
                true,
            );

            await executeCommand(
                TargetTreeDataProvider.selectTargetCommand,
                targetItem,
            );

            expect(targetStoreMock.setSelected).toHaveBeenCalledWith(target.id);
        });

        it('does not call setSelected when select command is executed with a non-target item', async () => {
            await provider.activate();

            await executeCommand(TargetTreeDataProvider.selectTargetCommand);

            expect(targetStoreMock.setSelected).not.toHaveBeenCalled();
        });
    });

    describe('removeTarget command', () => {
        it('invokes targetStore.deleteTarget when remove command is executed with a target item', async () => {
            const targetItem = new TargetTreeTargetItem(
                target,
                true,
                true,
                true,
            );
            targetStoreMock.getTargets.mockReturnValue([target]);
            await provider.activate();

            await executeCommand(
                TargetTreeDataProvider.removeTargetCommand,
                targetItem,
            );

            expect(targetStoreMock.deleteTarget).toHaveBeenCalledWith(
                target.id,
            );
        });

        it('does not call deleteTarget when remove command is executed with a non-target item', async () => {
            await provider.activate();

            await executeCommand(TargetTreeDataProvider.removeTargetCommand);

            expect(targetStoreMock.deleteTarget).not.toHaveBeenCalled();
        });

        it('shows an error when deleteTarget fails', async () => {
            const targetItem = new TargetTreeTargetItem(
                target,
                true,
                true,
                true,
            );
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
            const targetItem = new TargetTreeTargetItem(
                target,
                true,
                true,
                true,
            );
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
            const targetItem = new TargetTreeTargetItem(
                target,
                false,
                false,
                false,
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
