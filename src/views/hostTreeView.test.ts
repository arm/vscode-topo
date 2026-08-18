import * as vscode from 'vscode';
import { HostTreeView } from './hostTreeView';
import { HealthCheckGroupTreeItem } from './treeItems/healthCheckGroupTreeItem';
import { HealthCheckTreeItem } from './treeItems/healthCheckTreeItem';
import { HostModel } from '../models/hostModel';
import { errored, loaded } from '../util/loadable';
import { ErrorTreeItem } from './treeItems/errorTreeItem';
import { SkillStatusTreeItem } from './treeItems/skillStatusTreeItem';
import { LoadingTreeItem } from './treeItems/loadingTreeItem';
import { SkillGroupTreeItem } from './treeItems/skillGroupTreeItem';

const installedSkillReport = {
    status: 'installed' as const,
    agents: [
        {
            name: 'Claude Code',
            paths: ['/fake/home/.claude/skills/topo-cli-location'],
            status: 'installed' as const,
        },
        {
            name: 'Codex',
            paths: ['/fake/home/.agents/skills/topo-cli-location'],
            status: 'installed' as const,
        },
    ],
};

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

    it('returns the skill group and its reported agents', () => {
        const model = new HostModel();
        model.setSkillReport(loaded(installedSkillReport));
        const provider = new HostTreeView(model);

        const rootChildren = provider.getChildren();

        expect(rootChildren).toHaveLength(2);
        expect(rootChildren[0]).toBeInstanceOf(HealthCheckGroupTreeItem);
        expect(rootChildren[0].label).toBe('Health');
        expect(rootChildren[0].contextValue).toBe('Health');
        expect(rootChildren[1]).toEqual(
            new SkillGroupTreeItem(installedSkillReport),
        );

        const skillChildren = provider.getChildren(rootChildren[1]);
        expect(skillChildren).toEqual(
            installedSkillReport.agents.map(
                (agent) => new SkillStatusTreeItem(agent),
            ),
        );
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
        expect(children[1]).toEqual(new LoadingTreeItem('Topo Agent Skill'));
    });

    it('returns a loading item while the skill report refreshes', () => {
        const model = new HostModel();
        model.setSkillReport(loaded(installedSkillReport, true));
        const provider = new HostTreeView(model);

        const children = provider.getChildren();

        expect(children[1]).toEqual(new LoadingTreeItem('Topo Agent Skill'));
    });

    it('returns an error item when the skill report cannot be loaded', () => {
        const model = new HostModel();
        const erroredValue = errored('skills failed');
        model.setSkillReport(erroredValue);
        const provider = new HostTreeView(model);

        const children = provider.getChildren();

        expect(children[1]).toMatchObject(
            new ErrorTreeItem('Failed to check Topo Agent Skill', erroredValue),
        );
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

    it('fires onDidChangeTreeData when the skill report changes', () => {
        const model = new HostModel();
        const provider = new HostTreeView(model);
        const listener = vi.fn();
        provider.onDidChangeTreeData(listener);

        model.setSkillReport(loaded(installedSkillReport));

        expect(listener).toHaveBeenCalled();
    });
});
