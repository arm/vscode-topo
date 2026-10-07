import * as vscode from 'vscode';
import { ProjectsTreeView } from './projectsTreeView';
import { mutable } from '../util/test/mutable';
import { ProjectModel } from '../models/projectModel';
import { loaded, errored, loading } from '../util/loadable';
import { ErrorTreeItem } from './treeItems/errorTreeItem';
import { LoadingTreeItem } from './treeItems/loadingTreeItem';
import { ProjectMetadata } from '../util/project';
import { ContainerItem } from '../util/types';
import * as manifest from '../manifest';

const project: ProjectMetadata = {
    name: 'demo',
    uri: vscode.Uri.file('/fake/workspace/demo'),
    composeFileUri: vscode.Uri.file('/fake/workspace/demo/compose.yaml'),
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

    it('shows containers under their project and processing domain', () => {
        const model = new ProjectModel();
        const containers = loaded([container]);
        model.setProjects(loaded([project]));
        model.setProjectContainers(project, containers);
        const provider = new ProjectsTreeView(model);

        const projects = provider.getChildren();
        expect(projects).toMatchObject([{ label: 'demo' }]);

        const domains = provider.getChildren(projects[0]);
        expect(domains).toMatchObject([
            { label: manifest.PRIMARY_PROCESSING_DOMAIN },
        ]);
        expect(provider.getChildren(domains[0])).toMatchObject([
            { label: 'demo-app' },
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

        expect(children).toMatchObject([
            { label: 'demo', description: 'workspace' },
        ]);
    });
});
