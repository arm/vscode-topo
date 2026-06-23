import * as vscode from 'vscode';
import { ProjectsTreeView } from './projectsTreeView';
import { ProjectTreeItem } from '../treeItems/projectTreeItem';
import { mutable } from '../util/mutable';
import { ProjectModel } from '../models/projectModel';
import { loaded, errored, loading, unloaded } from '../util/loadable';
import { ErrorTreeItem } from '../treeItems/errorTreeItem';
import { LoadingTreeItem } from '../treeItems/loadingTreeItem';
import { ContainerTreeItem } from '../treeItems/containerTreeItem';
import { ProjectProcessingDomainTreeItem } from '../treeItems/projectProcessingDomainTreeItem';
import { ProjectMetadata } from '../util/project';

const project: ProjectMetadata = {
    name: 'demo',
    uri: vscode.Uri.file('/fake/workspace/demo'),
    composeFileUri: vscode.Uri.file('/fake/workspace/demo/compose.yaml'),
    workspaceIndex: 0,
    workspaceName: 'workspace',
};

describe('ProjectsTreeView', () => {
    let model: ProjectModel;
    function createProvider(): ProjectsTreeView {
        return new ProjectsTreeView(model);
    }

    function createProjectTreeItem(): ProjectTreeItem {
        return new ProjectTreeItem(project, false, unloaded());
    }

    beforeEach(() => {
        model = new ProjectModel();
        mutable(vscode.workspace).workspaceFolders = [
            {
                uri: vscode.Uri.file('/fake/workspace'),
                name: 'workspace',
                index: 0,
            },
        ];
    });

    afterEach(() => {
        vi.resetAllMocks();
        mutable(vscode.workspace).workspaceFolders = undefined;
    });

    it('registers the projects tree', () => {
        const provider = createProvider();

        expect(vscode.window.createTreeView).toHaveBeenCalledWith(
            ProjectsTreeView.viewId,
            {
                treeDataProvider: provider,
                showCollapseAll: false,
            },
        );
    });

    it('returns project items at the root', () => {
        model.setProjects(loaded([project]));
        const provider = createProvider();

        const children = provider.getChildren();

        expect(children).toHaveLength(1);
        expect(children[0]).toBeInstanceOf(ProjectTreeItem);
        expect(children[0]).toMatchObject({
            label: 'demo',
            tooltip: project.uri.fsPath,
            contextValue: 'Project',
        });
        expect((children[0] as ProjectTreeItem).composeFileUri.fsPath).toBe(
            project.composeFileUri.fsPath,
        );
        expect(children[0].resourceUri).toBeUndefined();
    });

    it('shows an error item when project loading fails', () => {
        model.setProjects(errored(new Error('scan failed')));
        const provider = createProvider();

        const children = provider.getChildren();

        expect(children).toHaveLength(1);
        expect(children[0]).toBeInstanceOf(ErrorTreeItem);
        expect(children[0]).toMatchObject({
            label: 'Failed to load projects',
            description: 'scan failed',
        });
    });

    it('shows a loading item while projects are loading', () => {
        model.setProjects(loading(loaded([])));
        const provider = createProvider();

        const children = provider.getChildren();

        expect(children).toHaveLength(1);
        expect(children[0]).toBeInstanceOf(LoadingTreeItem);
        expect(children[0].label).toBe('Loading projects');
    });

    it('shows a loading error item when refreshing after project loading failed', () => {
        model.setProjects(loading(errored(new Error('scan failed'))));
        const provider = createProvider();

        const children = provider.getChildren();

        expect(children).toHaveLength(1);
        expect(children[0]).toBeInstanceOf(ErrorTreeItem);
        expect(children[0]).toMatchObject({
            label: 'Failed to load projects',
            description: 'scan failed',
            iconPath: new vscode.ThemeIcon('loading~spin'),
        });
    });

    it('shows workspace names when there are multiple workspace folders', () => {
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
        const provider = createProvider();

        const children = provider.getChildren();

        expect(children[0].description).toBe('workspace');
    });

    it('marks loaded empty projects as stopped and non-expandable', () => {
        model.setProjects(loaded([project]));
        model.setProjectContainers(project, loaded([]));
        const provider = createProvider();

        const children = provider.getChildren();

        expect(children[0].collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.None,
        );
        expect(children[0].contextValue).toBe('Project');
    });

    it('returns processing domain children below running project items', () => {
        model.setProjects(loaded([project]));
        model.setProjectContainers(
            project,
            loaded([
                {
                    id: 'abc123',
                    names: 'app',
                    image: 'demo-app',
                    status: 'Up 1 minute',
                    state: 'running',
                    processingDomain: 'Linux Host',
                    address: 'localhost:8000',
                    target: 'user@topo.local',
                },
            ]),
        );
        const provider = createProvider();
        const projectItem = provider.getChildren()[0];

        const children = provider.getChildren(projectItem);

        expect(children).toHaveLength(1);
        expect(children[0]).toBeInstanceOf(ProjectProcessingDomainTreeItem);
        expect(children[0]).toMatchObject({
            label: 'Linux Host',
            description: '1 container',
        });
    });

    it('returns container children below processing domain items', () => {
        const container = {
            id: 'abc123',
            names: 'app',
            image: 'demo-app',
            status: 'Up 1 minute',
            state: 'running' as const,
            processingDomain: 'Linux Host',
            address: 'localhost:8000',
            target: 'user@topo.local',
        };
        const provider = createProvider();
        const processingDomainItem = new ProjectProcessingDomainTreeItem(
            'Linux Host',
            [container],
        );

        const children = provider.getChildren(processingDomainItem);

        expect(children).toHaveLength(1);
        expect(children[0]).toBeInstanceOf(ContainerTreeItem);
    });

    it('returns no children below projects with unloaded containers', () => {
        const provider = createProvider();
        const projectItem = createProjectTreeItem();

        const children = provider.getChildren(projectItem);

        expect(children).toEqual([]);
    });

    it('getTreeItem returns the element itself', () => {
        const provider = createProvider();
        const item = createProjectTreeItem();

        const treeItem = provider.getTreeItem(item);

        expect(treeItem).toBe(item);
    });
});
