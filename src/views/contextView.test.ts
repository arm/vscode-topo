import * as vscode from 'vscode';
import * as manifest from '../manifest';
import { ProjectModel } from '../models/projectModel';
import { TargetModel } from '../models/targetModel';
import { ProjectMetadata } from '../util/project';
import { errored, loaded } from '../util/loadable';
import { ContextView } from './contextView';

function createProject(name: string): ProjectMetadata {
    return {
        name,
        uri: vscode.Uri.file(`/fake/workspace/${name}`),
        composeFileUri: vscode.Uri.file(`/fake/workspace/${name}/compose.yaml`),
        workspaceIndex: 0,
        workspaceName: 'workspace',
    };
}

describe('ContextView', () => {
    let targetModel: TargetModel;
    let projectModel: ProjectModel;

    beforeEach(() => {
        targetModel = new TargetModel();
        projectModel = new ProjectModel();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('syncs model state when initialized', async () => {
        targetModel.setTargets(errored('Failed to load targets'));
        targetModel.setSelected('my-target');
        projectModel.setProjects(loaded([createProject('demo')]));

        const view = new ContextView(targetModel, projectModel);
        await view.initialize();

        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            'setContext',
            manifest.CONTEXT_TARGET_DATA_ISSUE,
            true,
        );
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            'setContext',
            manifest.CONTEXT_HAS_SELECTED_TARGET,
            true,
        );
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            'setContext',
            manifest.CONTEXT_HAS_PROJECTS,
            true,
        );
    });

    it('syncs selected target context when selected target changes', async () => {
        const view = new ContextView(targetModel, projectModel);
        await view.initialize();

        targetModel.setSelected('my-target');

        expect(vscode.commands.executeCommand).toHaveBeenLastCalledWith(
            'setContext',
            manifest.CONTEXT_HAS_SELECTED_TARGET,
            true,
        );
    });

    it('syncs target data issue context when target state changes', async () => {
        const view = new ContextView(targetModel, projectModel);
        await view.initialize();

        targetModel.setTargets(loaded(['my-target']));

        expect(vscode.commands.executeCommand).toHaveBeenLastCalledWith(
            'setContext',
            manifest.CONTEXT_TARGET_DATA_ISSUE,
            false,
        );
    });

    it('syncs project context when project state changes', async () => {
        const view = new ContextView(targetModel, projectModel);
        await view.initialize();

        projectModel.setProjects(loaded([createProject('demo')]));

        expect(vscode.commands.executeCommand).toHaveBeenLastCalledWith(
            'setContext',
            manifest.CONTEXT_HAS_PROJECTS,
            true,
        );
    });
});
