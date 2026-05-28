import path from 'node:path';
import os from 'node:os';
import * as vscode from 'vscode';
import { mock } from 'vitest-mock-extended';
import { executeTask } from './executeTask';
import { deploy, initProject, stop } from './project';
import { TopoCli } from '../topoCli';

vi.mock('./executeTask');

const executeTaskMock = vi.mocked(executeTask);

describe('project util', () => {
    const composeFilePath = path.join(os.tmpdir(), 'compose.yaml');
    const target = 'topo.local';

    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('stop', () => {
        it('runs topo stop from the compose file directory', async () => {
            await stop(composeFilePath, target);

            expect(executeTaskMock).toHaveBeenCalledWith(
                'Stop services on topo.local',
                ['topo', 'stop', '--target', 'topo.local'],
                { cwd: path.dirname(composeFilePath) },
            );
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                'Services on topo.local stopped successfully.',
            );
        });

        it('shows a task failure message', async () => {
            executeTaskMock.mockRejectedValueOnce(new Error('stop failed'));

            await stop(composeFilePath, target);

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Stopping services on topo.local failed: stop failed',
            );
        });
    });

    describe('deploy', () => {
        it('runs topo deploy from the compose file directory', async () => {
            await deploy(composeFilePath, target);

            expect(executeTaskMock).toHaveBeenCalledWith(
                'Deploy to topo.local',
                ['topo', 'deploy', '--target', 'topo.local'],
                { cwd: path.dirname(composeFilePath) },
            );
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                'Deployment to topo.local completed successfully.',
            );
        });

        it('shows a task failure message', async () => {
            executeTaskMock.mockRejectedValueOnce(new Error('deploy failed'));

            await deploy(composeFilePath, target);

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Deployment to topo.local failed: deploy failed',
            );
        });
    });

    describe('initProject', () => {
        it('initializes the project with topo cli', async () => {
            const topoCli = mock<TopoCli>();

            await initProject(topoCli, '/fake/workspace');

            expect(topoCli.init).toHaveBeenCalledWith('/fake/workspace');
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                'Project initialized successfully.',
            );
        });

        it('shows an error message if topoCli.init throws', async () => {
            const topoCli = mock<TopoCli>();
            topoCli.init.mockRejectedValueOnce(new Error('fail'));

            await initProject(topoCli, '/fake/workspace');

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Failed to initialize project: fail',
            );
        });
    });
});
