import { ProjectController } from './projectController';
import { ProjectModel } from '../models/projectModel';
import { findTopLevelComposeProjects, ProjectMetadata } from '../util/project';
import { loaded } from '../util/loadable';
import * as vscode from 'vscode';
import { mutable } from '../util/mutable';

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
const workspaceFolder: vscode.WorkspaceFolder = {
    uri: vscode.Uri.file('/fake/workspace'),
    name: 'workspace',
    index: 0,
};

describe('ProjectController', () => {
    beforeEach(() => {
        mutable(vscode.workspace).workspaceFolders = [workspaceFolder];
    });

    afterEach(() => {
        vi.resetAllMocks();
        mutable(vscode.workspace).workspaceFolders = undefined;
    });
    it('refreshes projects when requested', async () => {
        vi.mocked(findTopLevelComposeProjects).mockResolvedValue(projects);
        const model = new ProjectModel();

        const controller = new ProjectController(model);
        await controller.refreshProjects();

        expect(findTopLevelComposeProjects).toHaveBeenCalledWith([
            workspaceFolder,
        ]);
        expect(model.projects).toStrictEqual(loaded(projects));
    });

    it('stores an error when project discovery fails', async () => {
        vi.mocked(findTopLevelComposeProjects).mockRejectedValue(
            new Error('scan failed'),
        );
        const model = new ProjectModel();

        const controller = new ProjectController(model);
        await controller.refreshProjects();

        expect(model.projects.status).toBe('errored');
        if (model.projects.status === 'errored') {
            expect(model.projects.error.message).toBe('scan failed');
        }
    });

    it('does not let stale refresh results overwrite newer projects', async () => {
        const staleProjects: ProjectMetadata[] = [
            {
                name: 'stale',
                uri: vscode.Uri.file('/fake/workspace/stale'),
                composeFileUri: vscode.Uri.file(
                    '/fake/workspace/stale/compose.yaml',
                ),
                workspaceIndex: 0,
                workspaceName: 'workspace',
            },
        ];
        const refreshResolvers: ((projects: ProjectMetadata[]) => void)[] = [];
        vi.mocked(findTopLevelComposeProjects).mockImplementation(
            () => new Promise((resolve) => refreshResolvers.push(resolve)),
        );
        const model = new ProjectModel();

        const controller = new ProjectController(model);
        const staleRefresh = controller.refreshProjects();
        const latestRefresh = controller.refreshProjects();

        expect(refreshResolvers).toHaveLength(2);
        refreshResolvers[1](projects);
        await latestRefresh;
        refreshResolvers[0](staleProjects);
        await staleRefresh;

        await vi.waitFor(() => {
            expect(model.projects).toStrictEqual(loaded(projects));
        });
    });
});
