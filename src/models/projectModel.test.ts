import { ProjectModel } from './projectModel';
import { loaded } from '../util/loadable';
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
    it('defaults to an empty project list', () => {
        const model = new ProjectModel();

        expect(model.projects).toStrictEqual(loaded([]));
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
});
