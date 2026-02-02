import * as vscode from 'vscode';
import { ProjectInit } from './projectInit';
import { mutable } from './util/mutable';

jest.mock('vscode');

describe('ProjectInit', () => {
    let context: Pick<vscode.ExtensionContext, 'subscriptions'>;
    let topoCli: { init: jest.Mock };
    let projectInit: ProjectInit;
    const workspacePath = '/fake/workspace';

    beforeEach(() => {
        context = { subscriptions: [] };
        topoCli = { init: jest.fn() };
        jest.resetAllMocks();
        projectInit = new ProjectInit(context, topoCli);
    });

    it('registers the initProject command on activate', async () => {
        await projectInit.activate();

        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            ProjectInit.initProjectCommand,
            expect.any(Function),
        );
    });

    it('calls topoCli.init with currently opened workspace path', async () => {
        const workspaceUri = vscode.Uri.file(workspacePath);
        mutable(vscode.workspace).workspaceFolders = [
            { uri: workspaceUri, name: 'workspace', index: 0 },
        ];
        await projectInit.activate();

        await jest.mocked(vscode.commands.registerCommand).mock.calls[0][1]();

        expect(topoCli.init).toHaveBeenCalledWith(workspaceUri.fsPath);
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
            'Project initialized successfully.',
        );
    });

    it('shows error message if topoCli.init throws', async () => {
        topoCli.init.mockRejectedValue(new Error('fail'));
        await projectInit.activate();

        await jest.mocked(vscode.commands.registerCommand).mock.calls[0][1]();

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Failed to initialize project: fail',
        );
    });
});
