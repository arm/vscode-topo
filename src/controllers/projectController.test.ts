import { ProjectController } from './projectController';
import { ProjectModel } from '../models/projectModel';
import { findTopLevelComposeProjects, ProjectMetadata } from '../util/project';
import { loaded } from '../util/loadable';
import * as vscode from 'vscode';

vi.mock('../util/project');

const projects: ProjectMetadata[] = [
    {
        name: 'demo',
        uri: vscode.Uri.file('/fake/workspace/demo'),
        composeFileUri: vscode.Uri.file('/fake/workspace/demo/compose.yaml'),
        workspaceIndex: 0,
        workspaceName: 'workspace',
    },
];

describe('ProjectController', () => {
    afterEach(() => {
        vi.resetAllMocks();
    });

    it('refreshes projects on creation', async () => {
        vi.mocked(findTopLevelComposeProjects).mockResolvedValue(projects);
        const model = new ProjectModel();

        new ProjectController(model);
        await Promise.resolve();

        expect(findTopLevelComposeProjects).toHaveBeenCalled();
        expect(model.projects).toStrictEqual(loaded(projects));
    });

    it('stores an error when project discovery fails', async () => {
        vi.mocked(findTopLevelComposeProjects).mockRejectedValue(
            new Error('scan failed'),
        );
        const model = new ProjectModel();

        new ProjectController(model);
        await Promise.resolve();

        expect(model.projects.status).toBe('errored');
        if (model.projects.status === 'errored') {
            expect(model.projects.error.message).toBe('scan failed');
        }
    });
});
