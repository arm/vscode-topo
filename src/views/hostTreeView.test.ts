import * as vscode from 'vscode';
import { HostTreeView } from './hostTreeView';
import { HealthCheckDependencyGroupTreeItem } from '../treeItems/healthCheckDependencyGroupTreeItem';
import { HealthCheckDependencyTreeItem } from '../treeItems/healthCheckDependencyTreeItem';
import { failedToLoadHostDependenciesMessage } from '../treeItems/hostDependenciesLoadErrorItem';
import { HostModel } from '../models/hostModel';
import { showOutput } from '../commands';
import { errored, loaded } from '../util/loadable';

vi.mock('../util/logger');

describe('HostDependenciesTreeDataProvider', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('registers the host dependencies tree', () => {
        const provider = new HostTreeView(new HostModel());

        expect(vscode.window.createTreeView).toHaveBeenCalledWith(
            HostTreeView.viewId,
            {
                treeDataProvider: provider,
                showCollapseAll: false,
            },
        );
    });

    it('returns a Dependencies group at the root', async () => {
        const provider = new HostTreeView(new HostModel());

        const children = provider.getChildren();

        expect(children).toHaveLength(1);
        expect(children[0]).toBeInstanceOf(HealthCheckDependencyGroupTreeItem);
        expect(children[0].label).toBe('Dependencies');
        expect(children[0].contextValue).toBe('Dependencies');
    });

    it('returns host dependency items sorted by name below the Dependencies group', async () => {
        const model = new HostModel();
        model.setHealth(
            loaded({
                host: {
                    dependencies: [
                        {
                            name: 'Zed',
                            status: 'warning',
                            value: 'missing',
                            fix: {
                                description: 'Install Zed',
                                command:
                                    'topo install zed --target ssh://imx93',
                            },
                        },
                        {
                            name: 'Alpha',
                            status: 'ok',
                            value: 'installed',
                        },
                    ],
                },
            }),
        );
        const provider = new HostTreeView(model);

        const rootChildren = provider.getChildren();
        const children = provider.getChildren(rootChildren[0]);

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
                contextValue: 'Dependency Warning Fixable',
                description: 'missing',
            }),
        ]);
    });

    it('returns an error item when host health cannot be loaded', async () => {
        const model = new HostModel();
        model.setHealth(errored('Failed to load host health'));
        const provider = new HostTreeView(model);

        const children = provider.getChildren();

        expect(children).toHaveLength(1);
        expect(children[0]).toMatchObject({
            label: failedToLoadHostDependenciesMessage,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            command: {
                command: showOutput,
                title: 'Open Arm Topo Output',
            },
            contextValue: 'Dependencies Error',
            tooltip: 'Open the Arm Topo output channel for details.',
        });
    });

    it('getTreeItem returns the element itself', () => {
        const provider = new HostTreeView(new HostModel());
        const item = new HealthCheckDependencyTreeItem({
            name: 'Alpha',
            status: 'ok',
            value: 'installed',
        });

        const treeItem = provider.getTreeItem(item);

        expect(treeItem).toBe(item);
    });

    it('fires onDidChangeTreeData when host health changes', () => {
        const model = new HostModel();
        const provider = new HostTreeView(model);
        const listener = vi.fn();
        provider.onDidChangeTreeData(listener);

        model.setHealth(errored('irrelevant error'));

        expect(listener).toHaveBeenCalled();
    });
});
