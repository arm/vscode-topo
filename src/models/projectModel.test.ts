import { ProjectModel } from './projectModel';
import { loaded, unloaded } from '../util/loadable';
import { ProjectMetadata } from '../util/project';
import * as vscode from 'vscode';
import { ContainerItem } from '../util/types';

const projects: ProjectMetadata[] = [
    {
        name: 'demo',
        uri: vscode.Uri.file('/fake/workspace/demo'),
        composeFileUri: vscode.Uri.file('/fake/workspace/demo/compose.yaml'),
        workspaceIndex: 0,
        workspaceName: 'workspace',
    },
];

const otherProject: ProjectMetadata = {
    name: 'other',
    uri: vscode.Uri.file('/fake/workspace/other'),
    composeFileUri: vscode.Uri.file('/fake/workspace/other/compose.yaml'),
    workspaceIndex: 0,
    workspaceName: 'workspace',
};

const container: ContainerItem = {
    id: 'abc123',
    names: 'demo-app-1',
    image: 'demo-app',
    status: 'Up 1 minute',
    state: 'running',
    processingDomain: 'Linux Host',
    address: 'localhost:8000',
    target: 'user@topo.local',
};

describe('ProjectModel', () => {
    it('defaults to an unloaded state', () => {
        const model = new ProjectModel();

        expect(model.projects).toStrictEqual(unloaded());
        expect(model.getProjectContainers(projects[0])).toEqual(unloaded());
    });

    it('stores the latest projects loadable', () => {
        const model = new ProjectModel();
        const projectsLoadable = loaded(projects);

        model.setProjects(projectsLoadable);

        expect(model.projects).toBe(projectsLoadable);
    });

    it('fires onProjectsChanged when projects are updated', () => {
        const model = new ProjectModel();
        const onChanged = vi.fn();
        model.onProjectsChanged(onChanged);

        model.setProjects(loaded(projects));

        expect(onChanged).toHaveBeenCalledTimes(1);
    });

    it('fires onProjectsChanged when a different loadable is set', () => {
        const model = new ProjectModel();
        model.setProjects(loaded(projects));

        const onChanged = vi.fn();
        model.onProjectsChanged(onChanged);

        model.setProjects(loaded(projects));

        expect(onChanged).toHaveBeenCalledTimes(1);
    });

    it('stores containers by project', () => {
        const model = new ProjectModel();
        const containers = loaded([container]);

        model.setProjectContainers(projects[0], containers);

        expect(model.getProjectContainers(projects[0])).toBe(containers);
        expect(model.getProjectContainers(otherProject)).toEqual(unloaded());
    });

    it('clears project containers', () => {
        const model = new ProjectModel();
        model.setProjectContainers(projects[0], loaded([container]));

        model.clearProjectContainers();

        expect(model.getProjectContainers(projects[0])).toEqual(unloaded());
    });

    it('fires onProjectContainersChanged when containers change', () => {
        const model = new ProjectModel();
        const onChanged = vi.fn();
        model.onProjectContainersChanged(onChanged);

        model.setProjectContainers(projects[0], loaded([]));

        expect(onChanged).toHaveBeenCalledTimes(1);
    });
});
