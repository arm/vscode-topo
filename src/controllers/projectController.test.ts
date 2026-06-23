import { ProjectController } from './projectController';
import { ProjectModel } from '../models/projectModel';
import { findTopLevelComposeProjects, ProjectMetadata } from '../util/project';
import { loaded, unloaded } from '../util/loadable';
import * as vscode from 'vscode';
import { mutable } from '../util/mutable';
import { mock } from 'vitest-mock-extended';
import { TopoCli } from '../topoCli';
import { PsOutput, TargetHealthCheck } from '../topoCliSchema';
import { TargetModel } from '../models/targetModel';

vi.mock('../util/project');

const target = 'user@topo.local';
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
const workspaceFolder: vscode.WorkspaceFolder = {
    uri: vscode.Uri.file('/fake/workspace'),
    name: 'workspace',
    index: 0,
};
const healthyTarget: TargetHealthCheck = {
    destination: `ssh://${target}`,
    isLocalhost: false,
    connectivity: {
        name: 'Connectivity',
        status: 'ok',
        value: 'connected',
    },
    processingDomainDriver: {
        name: 'Processing Domain Driver',
        status: 'ok',
        value: 'ready',
    },
    dependencies: [],
};
const psOutput: PsOutput = {
    containers: [
        {
            id: 'abc123',
            names: 'demo-app-1',
            image: 'demo-app',
            status: 'Up 1 minute',
            state: 'running',
            processingDomain: 'Linux Host',
            address: 'localhost:8000',
        },
    ],
};

function createTargetModel(): TargetModel {
    return new TargetModel();
}

function createHealthyTargetModel(): TargetModel {
    const targetModel = new TargetModel();
    targetModel.setSelected(target);
    targetModel.setSelectedTargetHealth(loaded(healthyTarget));
    return targetModel;
}

describe('ProjectController', () => {
    let topoCli: TopoCli;

    beforeEach(() => {
        mutable(vscode.workspace).workspaceFolders = [workspaceFolder];
        topoCli = mock<TopoCli>();
    });

    afterEach(() => {
        vi.resetAllMocks();
        mutable(vscode.workspace).workspaceFolders = undefined;
    });

    it('refreshes projects when requested', async () => {
        vi.mocked(findTopLevelComposeProjects).mockResolvedValue(projects);
        const model = new ProjectModel();

        const controller = new ProjectController(
            model,
            topoCli,
            createTargetModel(),
        );
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

        const controller = new ProjectController(
            model,
            topoCli,
            createTargetModel(),
        );
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

        const controller = new ProjectController(
            model,
            topoCli,
            createTargetModel(),
        );
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

    it('loads containers for all projects at once', async () => {
        const model = new ProjectModel();
        model.setProjects(loaded([projects[0], otherProject]));
        const topoCli = mock<TopoCli>();
        topoCli.ps.mockResolvedValue(psOutput);
        const controller = new ProjectController(
            model,
            topoCli,
            createHealthyTargetModel(),
        );

        await controller.refreshProjectContainersCommandHandler();

        expect(topoCli.ps).toHaveBeenCalledWith(target, projects[0].uri.fsPath);
        expect(topoCli.ps).toHaveBeenCalledWith(
            target,
            otherProject.uri.fsPath,
        );
        expect(model.getProjectContainers(projects[0])).toEqual(
            loaded([{ ...psOutput.containers[0], target }]),
        );
        expect(model.getProjectContainers(otherProject)).toEqual(
            loaded([{ ...psOutput.containers[0], target }]),
        );
    });

    it('stores per-project errors without failing the whole refresh', async () => {
        const model = new ProjectModel();
        model.setProjects(loaded([projects[0], otherProject]));
        const topoCli = mock<TopoCli>();
        topoCli.ps.mockImplementation(async (_target, projectPath) => {
            if (projectPath === projects[0].uri.fsPath) {
                return psOutput;
            }
            throw new Error('ps failed');
        });
        const controller = new ProjectController(
            model,
            topoCli,
            createHealthyTargetModel(),
        );

        await controller.refreshProjectContainersCommandHandler();

        expect(model.getProjectContainers(projects[0])).toEqual(
            loaded([{ ...psOutput.containers[0], target }]),
        );
        expect(model.getProjectContainers(otherProject).status).toBe('errored');
    });

    it('clears containers when projects are unavailable', async () => {
        const model = new ProjectModel();
        model.setProjectContainers(projects[0], loaded([]));
        const controller = new ProjectController(
            model,
            mock<TopoCli>(),
            createHealthyTargetModel(),
        );

        await controller.refreshProjectContainersCommandHandler();

        expect(model.getProjectContainers(projects[0])).toEqual(unloaded());
    });
});
