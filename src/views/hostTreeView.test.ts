import * as vscode from 'vscode';
import { HostTreeView } from './hostTreeView';
import { HostModel } from '../models/hostModel';
import { errored, loaded } from '../util/loadable';
import { ErrorTreeItem } from './treeItems/errorTreeItem';
import { LoadingTreeItem } from './treeItems/loadingTreeItem';
import type { TopoSkillReport } from '../services/topoSkill';

const installedSkillReport: TopoSkillReport = {
    status: 'installed',
    agents: [
        {
            name: 'Claude Code',
            paths: ['/fake/home/.claude/skills/topo-cli-location'],
            status: 'installed',
        },
        {
            name: 'Codex',
            paths: ['/fake/home/.agents/skills/topo-cli-location'],
            status: 'installed',
        },
    ],
};

describe('HostTreeView', () => {
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

    it('shows the root groups before reports are loaded', () => {
        const provider = new HostTreeView(new HostModel());

        expect(provider.getChildren()).toMatchObject([
            { label: 'Container Engine', description: 'docker' },
            { label: 'Health', contextValue: 'Health' },
            { label: 'Topo Agent Skill' },
        ]);
    });

    it('shows health checks and installed agents under their root groups', () => {
        const model = new HostModel();
        model.setHealth(
            loaded({
                capabilities: [
                    {
                        name: 'Deployment',
                        checks: [
                            {
                                name: 'Container Engine',
                                location: 'host',
                                status: 'ok',
                                value: 'docker',
                            },
                        ],
                    },
                ],
            }),
        );
        model.setSkillReport(loaded(installedSkillReport));
        const provider = new HostTreeView(model);

        const rootChildren = provider.getChildren();

        expect(rootChildren).toMatchObject([
            { label: 'Container Engine', description: 'docker' },
            { label: 'Health' },
            { label: 'Topo Agent Skill' },
        ]);
        const capabilities = provider.getChildren(rootChildren[1]);
        expect(capabilities).toMatchObject([{ label: 'Deployment' }]);
        expect(provider.getChildren(capabilities[0])).toMatchObject([
            { label: 'Container Engine' },
        ]);
        expect(provider.getChildren(rootChildren[2])).toMatchObject([
            { label: 'Claude Code' },
            { label: 'Codex' },
        ]);
    });

    it('returns an error item when host health cannot be loaded', () => {
        const model = new HostModel();
        const erroredValue = errored('uh oh');
        model.setHealth(erroredValue);
        const provider = new HostTreeView(model);

        const children = provider.getChildren();

        expect(children).toMatchObject([
            { label: 'Container Engine', description: 'docker' },
            new ErrorTreeItem('Failed to load health', erroredValue),
            new LoadingTreeItem('Topo Agent Skill'),
        ]);
    });

    it('returns a loading item while the skill report refreshes', () => {
        const model = new HostModel();
        model.setSkillReport(loaded(installedSkillReport, true));
        const provider = new HostTreeView(model);

        const children = provider.getChildren();

        expect(children[2]).toEqual(new LoadingTreeItem('Topo Agent Skill'));
    });

    it('returns an error item when the skill report cannot be loaded', () => {
        const model = new HostModel();
        const erroredValue = errored('skills failed');
        model.setSkillReport(erroredValue);
        const provider = new HostTreeView(model);

        const children = provider.getChildren();

        expect(children[2]).toMatchObject(
            new ErrorTreeItem('Failed to check Topo Agent Skill', erroredValue),
        );
    });

    it('shows the engine before health loads', () => {
        const provider = new HostTreeView(new HostModel());

        const [engine] = provider.getChildren();

        expect(engine).toMatchObject({
            label: 'Container Engine',
            description: 'docker',
            tooltip:
                'Container engine: docker. Set by topo.containerEngine; Auto uses TOPO_ENGINE (Docker when unset).',
            collapsibleState: vscode.TreeItemCollapsibleState.None,
        });
    });

    it('shows the engine from TOPO_ENGINE in auto mode', () => {
        const model = new HostModel();
        const provider = new HostTreeView(model);
        const listener = vi.fn();
        provider.onDidChangeTreeData(listener);

        model.setContainerEngine('auto', 'podman');

        expect(listener).toHaveBeenCalledOnce();
        expect(provider.getChildren()[0]).toMatchObject({
            description: 'podman',
            tooltip:
                'Container engine: podman. Set by topo.containerEngine; Auto uses TOPO_ENGINE (Docker when unset).',
        });
    });

    it('shows invalid environment values without hiding health', () => {
        const model = new HostModel();
        model.setContainerEngine('auto', 'invalid');
        const provider = new HostTreeView(model);

        const [engine, health] = provider.getChildren();

        expect(engine).toMatchObject({
            label: 'Container Engine',
            description:
                'Invalid TOPO_ENGINE value "invalid": expected docker or podman',
        });
        expect(health).toMatchObject({ label: 'Health' });
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
