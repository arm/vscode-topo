import * as vscode from 'vscode';
import { ProjectInit, initProject } from './projectInit';
import { mutable } from '../util/mutable';
import { mock } from 'vitest-mock-extended';
import { TopoCli } from '../topoCli';
import { executeCommand } from '../util/test/executeCommand';

describe('ProjectInit', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mutable(vscode.workspace).workspaceFolders = undefined;
    });

    it('registers the initProject command on activate', async () => {
        const projectInit = new ProjectInit(mock<TopoCli>());
        projectInit.activate();

        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            ProjectInit.initProjectCommand,
            expect.any(Function),
        );
    });

    it('calls topoCli.init with currently opened workspace path', async () => {
        const workspaceUri = vscode.Uri.file('/fake/workspace');
        mutable(vscode.workspace).workspaceFolders = [
            { uri: workspaceUri, name: 'workspace', index: 0 },
        ];
        const topoCli = mock<TopoCli>();
        const projectInit = new ProjectInit(topoCli);
        projectInit.activate();

        await executeCommand(ProjectInit.initProjectCommand);

        expect(topoCli.init).toHaveBeenCalledWith(workspaceUri.fsPath);
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
            'Project initialized successfully.',
        );
    });

    it('shows error message if topoCli.init throws', async () => {
        const topoCli = mock<TopoCli>();
        topoCli.init.mockRejectedValue(new Error('fail'));

        await initProject(topoCli, '/fake/workspace');

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Failed to initialize project: fail',
        );
    });

    it('shows error message if no workspace folder is open', async () => {
        const topoCli = mock<TopoCli>();
        const projectInit = new ProjectInit(topoCli);
        projectInit.activate();

        await executeCommand(ProjectInit.initProjectCommand);

        expect(topoCli.init).not.toHaveBeenCalled();
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'No workspace folder is open. Please open a folder to initialize the project.',
        );
    });
});
