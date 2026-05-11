import * as vscode from 'vscode';
import { ProjectInit } from './projectInit';
import { mutable } from './util/mutable';
import { mock, MockProxy } from 'jest-mock-extended';
import { TopoCli } from './topoCli';

describe('ProjectInit', () => {
    let context: MockProxy<vscode.ExtensionContext>;
    let topoCli: MockProxy<TopoCli>;
    let projectInit: ProjectInit;
    const workspacePath = '/fake/workspace';

    beforeEach(() => {
        context = mock<vscode.ExtensionContext>({ subscriptions: [] });
        topoCli = mock<TopoCli>();
        jest.resetAllMocks();
        mutable(vscode.workspace).workspaceFolders = undefined;
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
        const workspaceUri = vscode.Uri.file(workspacePath);
        mutable(vscode.workspace).workspaceFolders = [
            { uri: workspaceUri, name: 'workspace', index: 0 },
        ];
        topoCli.init.mockRejectedValue(new Error('fail'));
        await projectInit.activate();

        await jest.mocked(vscode.commands.registerCommand).mock.calls[0][1]();

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Failed to initialize project: fail',
        );
    });

    it('shows error message if no workspace folder is open', async () => {
        await projectInit.activate();

        await jest.mocked(vscode.commands.registerCommand).mock.calls[0][1]();

        expect(topoCli.init).not.toHaveBeenCalled();
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'No workspace folder is open. Please open a folder to initialize the project.',
        );
    });
});
