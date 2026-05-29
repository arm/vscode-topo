import path from 'node:path';
import os from 'node:os';
import * as vscode from 'vscode';
import { mock, MockProxy } from 'vitest-mock-extended';
import { ProjectController } from './projectController';
import { TopoCli } from '../topoCli';
import { mutable } from '../util/mutable';
import * as projectUtil from '../util/project';
import { showAndLogError } from '../util/showAndLogError';
import { TargetModel } from '../models/targetModel';

vi.mock('../util/project');
vi.mock('../util/showAndLogError');

const projectStopMock = vi.mocked(projectUtil.stop);
const projectDeployMock = vi.mocked(projectUtil.deploy);
const projectInitMock = vi.mocked(projectUtil.initProject);
const showAndLogErrorMock = vi.mocked(showAndLogError);

describe('ProjectController', () => {
    const composeFileUri = vscode.Uri.file(
        path.join(os.tmpdir(), 'compose.yaml'),
    );
    const target = 'topo.local';
    let topoCli: MockProxy<TopoCli>;
    let targetModel: TargetModel;
    let controller: ProjectController;

    beforeEach(() => {
        vi.resetAllMocks();
        mutable(vscode.workspace).workspaceFolders = undefined;
        topoCli = mock<TopoCli>();
        targetModel = new TargetModel();
        targetModel.setSelected(target);
        controller = new ProjectController(topoCli, targetModel);
    });

    describe('stop', () => {
        it('requires a compose file resource', async () => {
            await expect(controller.stopCommandHandler()).rejects.toThrow(
                'No compose file selected for stop',
            );
            expect(projectStopMock).not.toHaveBeenCalled();
        });

        it('shows an error when no target is selected', async () => {
            targetModel.setSelected(undefined);

            await controller.stopCommandHandler(composeFileUri);

            expect(showAndLogErrorMock).toHaveBeenCalledWith(
                'Error executing stop command',
                expect.objectContaining({
                    message:
                        'No target selected. Please select a target before stopping.',
                }),
            );
            expect(projectStopMock).not.toHaveBeenCalled();
        });

        it('stops the project for the selected target', async () => {
            await controller.stopCommandHandler(composeFileUri);

            expect(projectStopMock).toHaveBeenCalledWith(
                composeFileUri.fsPath,
                target,
            );
        });
    });

    describe('deploy', () => {
        it('requires a compose file resource', async () => {
            await expect(controller.deployCommandHandler()).rejects.toThrow(
                'No compose file selected for deployment',
            );
            expect(projectDeployMock).not.toHaveBeenCalled();
        });

        it('shows an error when no target is selected', async () => {
            targetModel.setSelected(undefined);

            await controller.deployCommandHandler(composeFileUri);

            expect(showAndLogErrorMock).toHaveBeenCalledWith(
                'Error executing deploy command',
                expect.objectContaining({
                    message:
                        'No target selected. Please select a target before deploying.',
                }),
            );
            expect(projectDeployMock).not.toHaveBeenCalled();
        });

        it('deploys the project for the selected target', async () => {
            await controller.deployCommandHandler(composeFileUri);

            expect(projectDeployMock).toHaveBeenCalledWith(
                composeFileUri.fsPath,
                target,
            );
        });
    });

    describe('initProject', () => {
        it('shows an error if no workspace folder is open', async () => {
            await controller.initCommandHandler();

            expect(projectInitMock).not.toHaveBeenCalled();
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'No workspace folder is open. Please open a folder to initialize the project.',
            );
        });

        it('initializes the opened workspace', async () => {
            const workspaceUri = vscode.Uri.file('/fake/workspace');
            mutable(vscode.workspace).workspaceFolders = [
                { uri: workspaceUri, name: 'workspace', index: 0 },
            ];

            await controller.initCommandHandler();

            expect(projectInitMock).toHaveBeenCalledWith(
                topoCli,
                workspaceUri.fsPath,
            );
        });
    });
});
