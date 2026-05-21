import * as vscode from 'vscode';
import { HostTreeView } from './hostTreeView';
import { HealthCheckDependencyGroupTreeItem } from '../treeItems/healthCheckDependencyGroupTreeItem';
import { HealthCheckDependencyTreeItem } from '../treeItems/healthCheckDependencyTreeItem';
import { failedToLoadHostDependenciesMessage } from '../treeItems/hostDependenciesLoadErrorItem';
import { ShowOutput } from '../actions/showOutput';
import { HostModel } from '../models/hostModel';

jest.mock('../util/logger');

describe('HostDependenciesTreeDataProvider', () => {
    afterEach(() => {
        jest.clearAllMocks();
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

        const children = await provider.getChildren();

        expect(children).toHaveLength(1);
        expect(children[0]).toBeInstanceOf(HealthCheckDependencyGroupTreeItem);
        expect(children[0].label).toBe('Dependencies');
        expect(children[0].contextValue).toBe('Dependencies');
    });

    it('returns host dependency items sorted by name below the Dependencies group', async () => {
        const model = new HostModel();
        model.setHealth(
            Promise.resolve({
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

        const rootChildren = await provider.getChildren();
        const children = await provider.getChildren(rootChildren[0]);

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
        const model = new HostModel();
        model.setHealth(Promise.reject(new Error('health unavailable')));
        const provider = new HostTreeView(model);

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
        const provider = new HostTreeView(new HostModel());
        const item = new HealthCheckDependencyTreeItem({
            name: 'Alpha',
            status: 'ok',
            value: 'installed',
        });

        const treeItem = provider.getTreeItem(item);

        expect(treeItem).toBe(item);
    });
});
