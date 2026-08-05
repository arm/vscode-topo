import * as vscode from 'vscode';
import { HostTreeView } from './hostTreeView';
import { HealthCheckGroupTreeItem } from './treeItems/healthCheckGroupTreeItem';
import { HealthCheckTreeItem } from './treeItems/healthCheckTreeItem';
import { HostModel } from '../models/hostModel';
import { errored, loaded } from '../util/loadable';
import { ErrorTreeItem } from './treeItems/errorTreeItem';
import { SkillStatusTreeItem } from './treeItems/skillStatusTreeItem';
import { LoadingTreeItem } from './treeItems/loadingTreeItem';

describe('HostTreeView', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('registers the host health tree', () => {
        const provider = new HostTreeView(new HostModel());

        expect(vscode.window.createTreeView).toHaveBeenCalledWith(
            HostTreeView.viewId,
            {
                treeDataProvider: provider,
                showCollapseAll: false,
            },
        );
    });

    it('returns the current skill status after the Health group', () => {
        const model = new HostModel();
        model.setSkillStatus(loaded('installed'));
        const provider = new HostTreeView(model);

        const children = provider.getChildren();

        expect(children).toHaveLength(2);
        expect(children[0]).toBeInstanceOf(HealthCheckGroupTreeItem);
        expect(children[0].label).toBe('Health');
        expect(children[0].contextValue).toBe('Health');
        expect(children[1]).toEqual(new SkillStatusTreeItem('installed'));
    });

    it('returns sorted host health checks without mutating the model', () => {
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
            children.every((item) => item instanceof HealthCheckTreeItem),
        ).toBe(true);
        expect(children).toMatchObject([
            expect.objectContaining({
                label: 'Alpha',
                description: 'installed',
            }),
            expect.objectContaining({
                label: 'Zed',
                contextValue: 'HealthCheck Warning Fixable',
                description: 'missing',
            }),
        ]);
        expect(model.health).toMatchObject({
            data: {
                host: {
                    dependencies: [{ name: 'Zed' }, { name: 'Alpha' }],
                },
            },
        });
    });

    it('returns an error item when host health cannot be loaded', () => {
        const model = new HostModel();
        const erroredValue = errored('uh oh');
        model.setHealth(erroredValue);
        const provider = new HostTreeView(model);

        const children = provider.getChildren();

        expect(children).toHaveLength(2);
        expect(children[0]).toMatchObject(
            new ErrorTreeItem('Failed to load health', erroredValue),
        );
        expect(children[1]).toEqual(new LoadingTreeItem('Topo CLI skills'));
    });

    it('getTreeItem returns the element itself', () => {
        const provider = new HostTreeView(new HostModel());
        const item = new HealthCheckTreeItem(
            loaded({
                name: 'Alpha',
                status: 'ok',
                value: 'installed',
            }),
        );

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

    it('fires onDidChangeTreeData when the skill status changes', () => {
        const model = new HostModel();
        const provider = new HostTreeView(model);
        const listener = vi.fn();
        provider.onDidChangeTreeData(listener);

        model.setSkillStatus(loaded('installed'));

        expect(listener).toHaveBeenCalled();
    });
});
