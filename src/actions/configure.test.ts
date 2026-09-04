import os from 'node:os';
import path from 'node:path';
import * as vscode from 'vscode';
import { mock, MockProxy } from 'vitest-mock-extended';
import { createProjectTreeItem } from '../util/test/projectTreeItem';
import { runTask } from '../util/task';
import { TOPO_TASK_TYPE } from '../manifest';
import { TaskCommand, type TaskFactory } from '../tasks/taskFactory';
import { Configure, configure } from './configure';

vi.mock('../util/task');

const mockRunTask = vi.mocked(runTask);

describe('Configure', () => {
    const composeFileUri = vscode.Uri.file(
        path.join(os.tmpdir(), 'demo', 'compose.yaml'),
    );
    const projectPath = path.dirname(composeFileUri.fsPath);
    const task = new vscode.Task(
        { type: 'shell' },
        vscode.TaskScope.Workspace,
        'Configure task',
        'topo',
    );
    let taskFactory: MockProxy<TaskFactory>;
    let configureAction: Configure;

    function expectConfigureTask(): void {
        expect(taskFactory.createTask).toHaveBeenCalledWith('Configure demo', {
            type: TOPO_TASK_TYPE,
            command: TaskCommand.Configure,
            args: ['--file', 'compose.yaml'],
            options: { cwd: projectPath },
        });
        expect(mockRunTask).toHaveBeenCalledWith(task);
    }

    beforeEach(() => {
        taskFactory = mock<TaskFactory>();
        taskFactory.createTask.mockReturnValue(task);
        configureAction = new Configure(taskFactory);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('configures the selected compose file', async () => {
        await configureAction.configureContextCommandHandler(composeFileUri);

        expectConfigureTask();
    });

    it('configures the project tree item compose file', async () => {
        await configureAction.configureProjectCommandHandler(
            createProjectTreeItem(composeFileUri),
        );

        expectConfigureTask();
    });

    it('throws when the context command has no compose file', async () => {
        await expect(
            configureAction.configureContextCommandHandler(),
        ).rejects.toThrow('No compose.yaml selected for configuration');

        expect(mockRunTask).not.toHaveBeenCalled();
    });

    it('throws when the project command has no project tree item', async () => {
        await expect(
            configureAction.configureProjectCommandHandler(undefined),
        ).rejects.toThrow('This operation cannot be performed on this item');

        expect(mockRunTask).not.toHaveBeenCalled();
    });

    it('reports successful configuration', async () => {
        await configure(taskFactory, composeFileUri.fsPath);

        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
            'demo configured successfully.',
        );
    });

    it('rejects compose.yml without invoking topo', async () => {
        const unsupportedComposeFile = path.join(projectPath, 'compose.yml');

        await expect(
            configure(taskFactory, unsupportedComposeFile),
        ).rejects.toThrow(
            'Unsupported compose file "compose.yml". Only compose.yaml is supported.',
        );

        expect(mockRunTask).not.toHaveBeenCalled();
    });

    it('reports task failure', async () => {
        mockRunTask.mockRejectedValueOnce(new Error('configure failed'));

        await configure(taskFactory, composeFileUri.fsPath);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Configuring demo failed: configure failed',
        );
        expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
    });
});
