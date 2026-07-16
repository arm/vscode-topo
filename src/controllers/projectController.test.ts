import { ProjectController } from './projectController';
import { ProjectModel } from '../models/projectModel';
import { findTopLevelComposeProjects, ProjectMetadata } from '../util/project';
import { errored, loaded, loading, unloaded } from '../util/loadable';
import * as vscode from 'vscode';
import { mutable } from '../util/test/mutable';
import { mock } from 'vitest-mock-extended';
import { TopoCli } from '../services/topoCli';
import { PsOutput, TargetHealthReport } from '../services/topoCliSchema';
import { TargetModel } from '../models/targetModel';
import { PRIMARY_PROCESSING_DOMAIN } from '../manifest';

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
const healthyTarget: TargetHealthReport = {
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
            processingDomain: PRIMARY_PROCESSING_DOMAIN,
            address: 'localhost:8000',
        },
    ],
};

function createFileSystemWatcher(
    deleteEmitter: vscode.EventEmitter<vscode.Uri>,
): vscode.FileSystemWatcher {
    return {
        onDidCreate: new vscode.EventEmitter<vscode.Uri>().event,
        onDidChange: new vscode.EventEmitter<vscode.Uri>().event,
        onDidDelete: deleteEmitter.event,
        dispose: vi.fn(),
        ignoreCreateEvents: false,
        ignoreChangeEvents: false,
        ignoreDeleteEvents: false,
    };
}

describe('ProjectController', () => {
    beforeEach(() => {
        mutable(vscode.workspace).workspaceFolders = [workspaceFolder];
    });

    afterEach(() => {
        mutable(vscode.workspace).workspaceFolders = undefined;
    });

    it('refreshes projects when requested', async () => {
        vi.mocked(findTopLevelComposeProjects).mockResolvedValue(projects);
        const model = new ProjectModel();

        const controller = new ProjectController(
            model,
            mock<TopoCli>(),
            new TargetModel(),
        );
        await controller.refreshProjects();

        expect(findTopLevelComposeProjects).toHaveBeenCalledWith([
            workspaceFolder,
        ]);
        expect(model.projects).toStrictEqual(loaded(projects));
    });

    it('refreshes projects when a project ancestor is deleted', () => {
        const composeDeleteEmitter = new vscode.EventEmitter<vscode.Uri>();
        const ancestorDeleteEmitter = new vscode.EventEmitter<vscode.Uri>();
        vi.mocked(vscode.workspace.createFileSystemWatcher)
            .mockReturnValueOnce(createFileSystemWatcher(composeDeleteEmitter))
            .mockReturnValueOnce(
                createFileSystemWatcher(ancestorDeleteEmitter),
            );
        const model = new ProjectModel();
        model.setProjects(loaded(projects));
        const controller = new ProjectController(
            model,
            mock<TopoCli>(),
            new TargetModel(),
        );
        const refresh = vi
            .spyOn(controller, 'refreshProjects')
            .mockResolvedValue();

        expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledWith(
            '**',
            true,
            true,
            false,
        );

        ancestorDeleteEmitter.fire(projects[0].uri);

        expect(refresh).toHaveBeenCalledOnce();
    });

    it('does not refresh projects when an unrelated path is deleted', () => {
        const composeDeleteEmitter = new vscode.EventEmitter<vscode.Uri>();
        const ancestorDeleteEmitter = new vscode.EventEmitter<vscode.Uri>();
        vi.mocked(vscode.workspace.createFileSystemWatcher)
            .mockReturnValueOnce(createFileSystemWatcher(composeDeleteEmitter))
            .mockReturnValueOnce(
                createFileSystemWatcher(ancestorDeleteEmitter),
            );
        const model = new ProjectModel();
        model.setProjects(loaded(projects));
        const controller = new ProjectController(
            model,
            mock<TopoCli>(),
            new TargetModel(),
        );
        const refresh = vi
            .spyOn(controller, 'refreshProjects')
            .mockResolvedValue();

        ancestorDeleteEmitter.fire(vscode.Uri.file('/fake/workspace/other'));

        expect(refresh).not.toHaveBeenCalled();
    });

    it('stores an error when project discovery fails', async () => {
        const error = new Error('scan failed');
        vi.mocked(findTopLevelComposeProjects).mockRejectedValue(error);
        const model = new ProjectModel();

        const controller = new ProjectController(
            model,
            mock<TopoCli>(),
            new TargetModel(),
        );
        await controller.refreshProjects();

        expect(model.projects).toStrictEqual(errored(error));
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
            mock<TopoCli>(),
            new TargetModel(),
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
        const targetModel = new TargetModel();
        targetModel.setSelected(target);
        targetModel.setSelectedTargetHealth(loaded(healthyTarget));
        const model = new ProjectModel();
        model.setProjects(loaded([projects[0], otherProject]));
        const topoCli = mock<TopoCli>();
        topoCli.ps.mockResolvedValue(psOutput);
        const controller = new ProjectController(model, topoCli, targetModel);

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
        const targetModel = new TargetModel();
        targetModel.setSelected(target);
        targetModel.setSelectedTargetHealth(loaded(healthyTarget));
        const model = new ProjectModel();
        model.setProjects(loaded([projects[0], otherProject]));
        const topoCli = mock<TopoCli>();
        topoCli.ps.mockImplementation(async (_target, projectPath) => {
            if (projectPath === projects[0].uri.fsPath) {
                return psOutput;
            }
            throw new Error('ps failed');
        });
        const controller = new ProjectController(model, topoCli, targetModel);

        await controller.refreshProjectContainersCommandHandler();

        expect(model.getProjectContainers(projects[0])).toEqual(
            loaded([{ ...psOutput.containers[0], target }]),
        );
        expect(model.getProjectContainers(otherProject).status).toBe('errored');
    });

    it('keeps existing containers while target health is loading', async () => {
        const targetModel = new TargetModel();
        targetModel.setSelected(target);
        targetModel.setSelectedTargetHealth(loading(loaded(healthyTarget)));
        const model = new ProjectModel();
        model.setProjects(loaded(projects));
        model.setProjectContainers(projects[0], loaded([]));
        const controller = new ProjectController(
            model,
            mock<TopoCli>(),
            targetModel,
        );

        await controller.refreshProjectContainersCommandHandler();

        expect(model.getProjectContainers(projects[0])).toEqual(loaded([]));
    });

    it('clears containers when target connectivity is unhealthy', async () => {
        const targetModel = new TargetModel();
        targetModel.setSelected(target);
        targetModel.setSelectedTargetHealth(
            loaded({
                ...healthyTarget,
                connectivity: {
                    ...healthyTarget.connectivity,
                    status: 'error',
                },
            }),
        );
        const model = new ProjectModel();
        model.setProjects(loaded(projects));
        model.setProjectContainers(projects[0], loaded([]));
        const controller = new ProjectController(
            model,
            mock<TopoCli>(),
            targetModel,
        );

        await controller.refreshProjectContainersCommandHandler();

        expect(model.getProjectContainers(projects[0])).toEqual(unloaded());
    });

    it('clears containers when projects are unavailable', async () => {
        const model = new ProjectModel();
        model.setProjectContainers(projects[0], loaded([]));
        const controller = new ProjectController(
            model,
            mock<TopoCli>(),
            new TargetModel(),
        );

        await controller.refreshProjectContainersCommandHandler();

        expect(model.getProjectContainers(projects[0])).toEqual(unloaded());
    });
});
