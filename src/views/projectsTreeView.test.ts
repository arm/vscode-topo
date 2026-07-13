import * as vscode from 'vscode';
import { ProjectsTreeView } from './projectsTreeView';
import { ProjectTreeItem } from './treeItems/projectTreeItem';
import { mutable } from '../util/test/mutable';
import { ProjectModel } from '../models/projectModel';
import { loaded, errored, loading, unloaded } from '../util/loadable';
import { ErrorTreeItem } from './treeItems/errorTreeItem';
import { LoadingTreeItem } from './treeItems/loadingTreeItem';
import { ContainerTreeItem } from './treeItems/containerTreeItem';
import { ProcessingDomainTreeItem } from './treeItems/processingDomainTreeItem';
import { ProjectMetadata } from '../util/project';
import { ContainerItem } from '../util/types';
import * as manifest from '../manifest';

const project: ProjectMetadata = {
    name: 'demo',
    uri: vscode.Uri.file('/fake/workspace/demo'),
    composeFileUris: [vscode.Uri.file('/fake/workspace/demo/compose.yaml')],
    workspaceIndex: 0,
    workspaceName: 'workspace',
};

const container: ContainerItem = {
    id: 'abc123',
    names: 'app',
    image: 'demo-app',
    status: 'Up 1 minute',
    state: 'running',
    processingDomain: manifest.PRIMARY_PROCESSING_DOMAIN,
    address: 'localhost:8000',
    target: 'user@topo.local',
};

describe('ProjectsTreeView', () => {
    it('registers the projects tree', () => {
        const model = new ProjectModel();
        const provider = new ProjectsTreeView(model);

        expect(vscode.window.createTreeView).toHaveBeenCalledWith(
            ProjectsTreeView.viewId,
            {
                treeDataProvider: provider,
                showCollapseAll: false,
            },
        );
    });

    it('syncs project count context', () => {
        const model = new ProjectModel();
        new ProjectsTreeView(model);

        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            'setContext',
            manifest.CONTEXT_PROJECT_COUNT,
            undefined,
        );

        vi.mocked(vscode.commands.executeCommand).mockClear();
        model.setProjects(loaded([]));

        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            'setContext',
            manifest.CONTEXT_PROJECT_COUNT,
            0,
        );
    });

    it('returns project items at the root', () => {
        const model = new ProjectModel();
        model.setProjects(loaded([project]));
        const provider = new ProjectsTreeView(model);

        const children = provider.getChildren();

        expect(children).toStrictEqual([
            new ProjectTreeItem(project, false, unloaded()),
        ]);
    });

    it('shows an error item when project loading fails', () => {
        const model = new ProjectModel();
        const projects = errored(new Error('scan failed'));
        model.setProjects(projects);
        const provider = new ProjectsTreeView(model);

        const children = provider.getChildren();

        expect(children).toStrictEqual([
            new ErrorTreeItem('Failed to load projects', projects),
        ]);
    });

    it('shows a loading item while projects are loading', () => {
        const model = new ProjectModel();
        model.setProjects(loading(loaded([])));
        const provider = new ProjectsTreeView(model);

        const children = provider.getChildren();

        expect(children).toStrictEqual([
            new LoadingTreeItem('Loading projects'),
        ]);
    });

    it('shows a loading error item when refreshing after project loading failed', () => {
        const model = new ProjectModel();
        const projects = loading(errored(new Error('scan failed')));
        model.setProjects(projects);
        const provider = new ProjectsTreeView(model);

        const children = provider.getChildren();

        expect(children).toStrictEqual([
            new ErrorTreeItem('Failed to load projects', projects),
        ]);
    });

    it('shows workspace names when there are multiple workspace folders', () => {
        const model = new ProjectModel();
        mutable(vscode.workspace).workspaceFolders = [
            {
                uri: vscode.Uri.file('/fake/workspace'),
                name: 'workspace',
                index: 0,
            },
            {
                uri: vscode.Uri.file('/fake/other'),
                name: 'other',
                index: 1,
            },
        ];
        model.setProjects(loaded([project]));
        const provider = new ProjectsTreeView(model);

        const children = provider.getChildren();

        expect(children[0].description).toBe('workspace');
    });

    it('marks loaded empty projects as stopped and non-expandable', () => {
        const model = new ProjectModel();
        model.setProjects(loaded([project]));
        model.setProjectContainers(project, loaded([]));
        const provider = new ProjectsTreeView(model);

        const children = provider.getChildren();

        expect(children[0].collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.None,
        );
        expect(children[0].contextValue).toBe('Project');
    });

    it('returns processing domain children below running project items', () => {
        const model = new ProjectModel();
        const containers = [container];
        model.setProjects(loaded([project]));
        model.setProjectContainers(project, loaded(containers));
        const provider = new ProjectsTreeView(model);
        const projectItem = provider.getChildren()[0];

        const children = provider.getChildren(projectItem);

        expect(children).toStrictEqual([
            new ProcessingDomainTreeItem(
                container.processingDomain,
                containers,
            ),
        ]);
    });

    it('returns container children below processing domain items', () => {
        const model = new ProjectModel();
        const provider = new ProjectsTreeView(model);
        const processingDomainItem = new ProcessingDomainTreeItem(
            container.processingDomain,
            [container],
        );

        const children = provider.getChildren(processingDomainItem);

        expect(children).toStrictEqual([new ContainerTreeItem(container)]);
    });

    it('returns no children below projects with unloaded containers', () => {
        const model = new ProjectModel();
        const provider = new ProjectsTreeView(model);
        const projectItem = new ProjectTreeItem(project, false, unloaded());

        const children = provider.getChildren(projectItem);

        expect(children).toEqual([]);
    });

    it('getTreeItem returns the element itself', () => {
        const model = new ProjectModel();
        const provider = new ProjectsTreeView(model);
        const item = new ProjectTreeItem(project, false, unloaded());

        const treeItem = provider.getTreeItem(item);

        expect(treeItem).toBe(item);
    });

    it('displays primary processing domain first, followed by other domains in alphabetical order', () => {
        const model = new ProjectModel();
        const containers = loaded([
            { ...container, processingDomain: 'another-rproc2' },
            { ...container, processingDomain: 'some-rproc' },
            container,
            { ...container, processingDomain: 'another-rproc' },
        ]);
        model.setProjectContainers(project, containers);
        const provider = new ProjectsTreeView(model);

        const children = provider.getChildren(
            new ProjectTreeItem(project, false, containers),
        );

        expect(children).toMatchObject([
            { label: container.processingDomain },
            { label: 'another-rproc' },
            { label: 'another-rproc2' },
            { label: 'some-rproc' },
        ]);
    });
});
