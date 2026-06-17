import { ProjectModel } from './projectModel';
import { loaded, unloaded } from '../util/loadable';
import { ProjectMetadata } from '../util/project';
import * as vscode from 'vscode';

const projects: ProjectMetadata[] = [
    {
        name: 'demo',
        uri: vscode.Uri.file('/fake/workspace/demo'),
        composeFileUri: vscode.Uri.file('/fake/workspace/demo/compose.yaml'),
        workspaceIndex: 0,
        workspaceName: 'workspace',
    },
];

describe('ProjectModel', () => {
    it('defaults to an unloaded state', () => {
        const model = new ProjectModel();

        expect(model.projects).toStrictEqual(unloaded());
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
});
