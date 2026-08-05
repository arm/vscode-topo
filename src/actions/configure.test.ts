import os from 'node:os';
import path from 'node:path';
import * as vscode from 'vscode';
import { mock, MockProxy } from 'vitest-mock-extended';
import { TaskExecutor } from '../util/taskExecutor';
import { createProjectTreeItem } from '../util/test/projectTreeItem';
import { Configure, configure } from './configure';

describe('Configure', () => {
    const composeFileUri = vscode.Uri.file(
        path.join(os.tmpdir(), 'demo', 'compose.yml'),
    );
    const projectPath = path.dirname(composeFileUri.fsPath);
    let taskExecutor: MockProxy<TaskExecutor>;
    let configureAction: Configure;

    function expectConfigureTask(task: vscode.Task): void {
        expect(task.name).toBe('Configure demo');
        expect(task.execution).toMatchObject({
            process: 'topo',
            args: ['configure', '--file', 'compose.yml'],
            options: { cwd: projectPath },
        });
    }

    beforeEach(() => {
        taskExecutor = mock<TaskExecutor>();
        configureAction = new Configure(taskExecutor);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('configures the selected compose file', async () => {
        await configureAction.configureContextCommandHandler(composeFileUri);

        expect(taskExecutor.run).toHaveBeenCalledOnce();
        expectConfigureTask(taskExecutor.run.mock.calls[0][0]);
    });

    it('configures the project tree item compose file', async () => {
        await configureAction.configureProjectCommandHandler(
            createProjectTreeItem(composeFileUri),
        );

        expect(taskExecutor.run).toHaveBeenCalledOnce();
        expectConfigureTask(taskExecutor.run.mock.calls[0][0]);
    });

    it('throws when the context command has no compose file', async () => {
        await expect(
            configureAction.configureContextCommandHandler(),
        ).rejects.toThrow(
            'No compose.yaml or compose.yml selected for configuration',
        );

        expect(taskExecutor.run).not.toHaveBeenCalled();
    });

    it('throws when the project command has no project tree item', async () => {
        await expect(
            configureAction.configureProjectCommandHandler(undefined),
        ).rejects.toThrow('This operation cannot be performed on this item');

        expect(taskExecutor.run).not.toHaveBeenCalled();
    });

    it('reports successful configuration', async () => {
        await configure(taskExecutor, composeFileUri.fsPath);

        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
            'demo configured successfully.',
        );
    });

    it('reports task failure', async () => {
        taskExecutor.run.mockRejectedValueOnce(new Error('configure failed'));

        await configure(taskExecutor, composeFileUri.fsPath);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Configuring demo failed: configure failed',
        );
        expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
    });
});
