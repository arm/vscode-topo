import * as vscode from 'vscode';
import { ProjectsTreeView } from './projectsTreeView';
import { ProjectTreeItem } from '../treeItems/projectTreeItem';
import { mutable } from '../util/mutable';
import { ProjectModel } from '../models/projectModel';
import { loaded, errored } from '../util/loadable';
import { ErrorTreeItem } from '../treeItems/errorTreeItem';

describe('ProjectsTreeView', () => {
    let model: ProjectModel;

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
        const provider = new ProjectsTreeView(model);

        expect(vscode.window.createTreeView).toHaveBeenCalledWith(
            ProjectsTreeView.viewId,
            {
                treeDataProvider: provider,
                showCollapseAll: false,
            },
        );
    });

    it('returns project items at the root', () => {
        model.setProjects(
            loaded([
                {
                    name: 'demo',
                    uri: vscode.Uri.file('/fake/workspace/demo'),
                    composeFileUri: vscode.Uri.file(
                        '/fake/workspace/demo/compose.yaml',
                    ),
                    workspaceIndex: 0,
                    workspaceName: 'workspace',
                },
            ]),
        );
        const provider = new ProjectsTreeView(model);

        const children = provider.getChildren();

        expect(children).toHaveLength(1);
        expect(children[0]).toBeInstanceOf(ProjectTreeItem);
        expect(children[0]).toMatchObject({
            label: 'demo',
            tooltip: '/fake/workspace/demo',
            contextValue: 'Project',
            composeFileUri: vscode.Uri.file(
                '/fake/workspace/demo/compose.yaml',
            ),
        });
        expect(children[0].resourceUri).toBeUndefined();
    });

    it('shows an error item when project loading fails', () => {
        model.setProjects(errored(new Error('scan failed')));
        const provider = new ProjectsTreeView(model);

        const children = provider.getChildren();

        expect(children).toHaveLength(1);
        expect(children[0]).toBeInstanceOf(ErrorTreeItem);
        expect(children[0]).toMatchObject({
            label: 'Failed to load projects',
            description: 'scan failed',
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
        model.setProjects(
            loaded([
                {
                    name: 'demo',
                    uri: vscode.Uri.file('/fake/workspace/demo'),
                    composeFileUri: vscode.Uri.file(
                        '/fake/workspace/demo/compose.yaml',
                    ),
                    workspaceIndex: 0,
                    workspaceName: 'workspace',
                },
            ]),
        );
        const provider = new ProjectsTreeView(model);

        const children = provider.getChildren();

        expect(children[0].description).toBe('workspace');
    });

    it('returns no children below project items', () => {
        const provider = new ProjectsTreeView(model);
        const projectItem = new ProjectTreeItem(
            {
                name: 'demo',
                uri: vscode.Uri.file('/fake/workspace/demo'),
                composeFileUri: vscode.Uri.file(
                    '/fake/workspace/demo/compose.yaml',
                ),
                workspaceIndex: 0,
                workspaceName: 'workspace',
            },
            false,
        );

        const children = provider.getChildren(projectItem);

        expect(children).toEqual([]);
    });

    it('getTreeItem returns the element itself', () => {
        const provider = new ProjectsTreeView(model);
        const item = new ProjectTreeItem(
            {
                name: 'demo',
                uri: vscode.Uri.file('/fake/workspace/demo'),
                composeFileUri: vscode.Uri.file(
                    '/fake/workspace/demo/compose.yaml',
                ),
                workspaceIndex: 0,
                workspaceName: 'workspace',
            },
            false,
        );

        const treeItem = provider.getTreeItem(item);

        expect(treeItem).toBe(item);
    });
});
