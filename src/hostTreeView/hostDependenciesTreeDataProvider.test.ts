import * as vscode from 'vscode';
import { mock, MockProxy } from 'jest-mock-extended';
import { HostDependenciesTreeDataProvider } from './hostDependenciesTreeDataProvider';
import { TopoCli } from '../topoCli';
import { HealthCheckResult } from '../topoCliSchema';
import { HealthCheckDependencyGroupTreeItem } from '../treeItems/healthCheckDependencyGroupTreeItem';
import { HealthCheckDependencyTreeItem } from '../treeItems/healthCheckDependencyTreeItem';
import { failedToLoadHostDependenciesMessage } from './hostDependenciesLoadErrorItem';
import { ShowOutput } from '../actions/showOutput';

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

describe('HostDependenciesTreeDataProvider', () => {
    let context: MockProxy<vscode.ExtensionContext>;
    let topoCli: MockProxy<TopoCli>;
    let provider: HostDependenciesTreeDataProvider;
    const health: HealthCheckResult = {
        host: {
            dependencies: [
                {
                    name: 'Zed',
                    status: 'warning',
                    value: 'missing',
                    fix: 'run `topo install zed`',
                },
                {
                    name: 'Alpha',
                    status: 'ok',
                    value: 'installed',
                },
            ],
        },
        target: {
            isLocalhost: true,
            dependencies: [],
            connectivity: {
                name: 'Connectivity',
                status: 'ok',
                value: 'ok',
            },
            subsystemDriver: {
                name: 'Subsystem Driver',
                status: 'ok',
                value: 'ready',
            },
        },
    };

    beforeEach(() => {
        context = mock<vscode.ExtensionContext>({ subscriptions: [] });
        topoCli = mock<TopoCli>();
        topoCli.hostHealth.mockResolvedValue(health);
        provider = new HostDependenciesTreeDataProvider(context, topoCli);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('registers the host dependencies tree and refresh command', () => {
        provider.activate();

        expect(vscode.window.createTreeView).toHaveBeenCalledWith(
            HostDependenciesTreeDataProvider.viewId,
            {
                treeDataProvider: provider,
                showCollapseAll: false,
            },
        );
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            HostDependenciesTreeDataProvider.refreshCommand,
            expect.any(Function),
        );
        expect(context.subscriptions.length).toBeGreaterThan(0);
    });

    it('returns a Dependencies group at the root', async () => {
        const children = await provider.getChildren();

        expect(topoCli.hostHealth).toHaveBeenCalledWith();
        expect(children).toHaveLength(1);
        expect(children[0]).toBeInstanceOf(HealthCheckDependencyGroupTreeItem);
        expect(children[0].label).toBe('Dependencies');
        expect(children[0].contextValue).toBe('Dependencies');
    });

    it('returns host dependency items sorted by name below the Dependencies group', async () => {
        const rootChildren = await provider.getChildren();
        const children = await provider.getChildren(rootChildren[0]);

        expect(topoCli.hostHealth).toHaveBeenCalledWith();
        expect(children).toHaveLength(2);
        expect(
            children.every(
                (item) => item instanceof HealthCheckDependencyTreeItem,
            ),
        ).toBe(true);
        expect(children).toMatchObject([
            expect.objectContaining({
                label: 'Alpha',
                description: 'installed',
            }),
            expect.objectContaining({
                label: 'Zed',
                contextValue: 'Dependency Warning Installable',
                description: 'missing',
            }),
        ]);
    });

    it('returns an error item when host health cannot be loaded', async () => {
        topoCli.hostHealth.mockRejectedValueOnce(
            new Error('health unavailable'),
        );

        const children = await provider.getChildren();

        expect(children).toHaveLength(1);
        expect(children[0]).toMatchObject({
            label: failedToLoadHostDependenciesMessage,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            command: {
                command: ShowOutput.showOutputCommand,
                title: 'Open Arm Topo Output',
            },
            contextValue: 'Dependencies Error',
            tooltip: 'Open the Arm Topo output channel for details.',
        });
    });

    it('getTreeItem returns the element itself', () => {
        const item = new HealthCheckDependencyTreeItem(
            health.host.dependencies[0],
        );

        const treeItem = provider.getTreeItem(item);

        expect(treeItem).toBe(item);
    });

    it('refresh command fires the tree data event', async () => {
        provider.activate();
        const spy = jest.fn();
        provider.onDidChangeTreeData(spy);

        await executeCommand(HostDependenciesTreeDataProvider.refreshCommand);

        expect(spy).toHaveBeenCalledWith(undefined);
    });
});
