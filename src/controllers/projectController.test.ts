import path from 'node:path';
import os from 'node:os';
import * as vscode from 'vscode';
import { mock, MockProxy } from 'vitest-mock-extended';
import { ProjectController } from './projectController';
import { TargetStore } from '../target/targetStore';
import { TopoCli } from '../topoCli';
import { mutable } from '../util/mutable';
import * as projectUtil from '../util/project';
import { showAndLogError } from '../util/showAndLogError';

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
    let targetStore: MockProxy<TargetStore>;
    let controller: ProjectController;

    beforeEach(() => {
        vi.resetAllMocks();
        mutable(vscode.workspace).workspaceFolders = undefined;
        topoCli = mock<TopoCli>();
        targetStore = mock<TargetStore>();
        targetStore.getSelectedTarget.mockReturnValue(target);
        controller = new ProjectController(topoCli, targetStore);
    });

    describe('stop', () => {
        it('requires a compose file resource', async () => {
            await expect(controller.stop()).rejects.toThrow(
                'No compose file selected for stop',
            );
            expect(projectStopMock).not.toHaveBeenCalled();
        });

        it('shows an error when no target is selected', async () => {
            targetStore.getSelectedTarget.mockReturnValueOnce(undefined);

            await controller.stop(composeFileUri);

            expect(showAndLogErrorMock).toHaveBeenCalledWith(
                'Error executing stop command',
                expect.objectContaining({
                    message:
                        'No target selected. Please select a target before stopping.',
                }),
            );
            expect(projectStopMock).not.toHaveBeenCalled();
        });

        it('rethrows target lookup errors', async () => {
            targetStore.getSelectedTarget.mockImplementationOnce(() => {
                throw new Error('target store failed');
            });

            await expect(controller.stop(composeFileUri)).rejects.toThrow(
                'target store failed',
            );
            expect(showAndLogErrorMock).not.toHaveBeenCalled();
            expect(projectStopMock).not.toHaveBeenCalled();
        });

        it('stops the project for the selected target', async () => {
            await controller.stop(composeFileUri);

            expect(projectStopMock).toHaveBeenCalledWith(
                composeFileUri.fsPath,
                target,
            );
        });
    });

    describe('deploy', () => {
        it('requires a compose file resource', async () => {
            await expect(controller.deploy()).rejects.toThrow(
                'No compose file selected for deployment',
            );
            expect(projectDeployMock).not.toHaveBeenCalled();
        });

        it('shows an error when no target is selected', async () => {
            targetStore.getSelectedTarget.mockReturnValueOnce(undefined);

            await controller.deploy(composeFileUri);

            expect(showAndLogErrorMock).toHaveBeenCalledWith(
                'Error executing deploy command',
                expect.objectContaining({
                    message:
                        'No target selected. Please select a target before deploying.',
                }),
            );
            expect(projectDeployMock).not.toHaveBeenCalled();
        });

        it('rethrows target lookup errors', async () => {
            targetStore.getSelectedTarget.mockImplementationOnce(() => {
                throw new Error('target store failed');
            });

            await expect(controller.deploy(composeFileUri)).rejects.toThrow(
                'target store failed',
            );
            expect(showAndLogErrorMock).not.toHaveBeenCalled();
            expect(projectDeployMock).not.toHaveBeenCalled();
        });

        it('deploys the project for the selected target', async () => {
            await controller.deploy(composeFileUri);

            expect(projectDeployMock).toHaveBeenCalledWith(
                composeFileUri.fsPath,
                target,
            );
        });
    });

    describe('initProject', () => {
        it('shows an error if no workspace folder is open', async () => {
            await controller.initProject();

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

            await controller.initProject();

            expect(projectInitMock).toHaveBeenCalledWith(
                topoCli,
                workspaceUri.fsPath,
            );
        });
    });
});
