import * as vscode from 'vscode';
import { ProjectInit } from './projectInit';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('vscode');

describe('ProjectInit', () => {
    let context: { subscriptions: any[] };
    let topoCli: { initProject: jest.Mock };
    let projectInit: ProjectInit;
    const selectedFolderPath = '/folder';

    beforeEach(() => {
        context = { subscriptions: [] };
        topoCli = { initProject: jest.fn() };
        jest.clearAllMocks();
        (vscode.commands.registerCommand as jest.Mock).mockImplementation((_cmd, cb) => cb);
        (vscode.window.showOpenDialog as jest.Mock).mockResolvedValue([{ fsPath: selectedFolderPath }]);
        (vscode.window.showInputBox as jest.Mock).mockResolvedValue('my-project');
        (vscode.window.showInformationMessage as jest.Mock).mockImplementation(jest.fn());
        (vscode.window.showErrorMessage as jest.Mock).mockImplementation(jest.fn());
        projectInit = new ProjectInit(context as any, topoCli as any);
    });

    it('registers the initProject command on activate', async () => {
        await projectInit.activate();
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            ProjectInit.initProjectCommand,
            expect.any(Function)
        );
    });

    it('calls topoCli.initProject with correct arguments', async () => {
        await projectInit.activate();
        await (vscode.commands.registerCommand as jest.Mock).mock.calls[0][1]();
        const projectPath = selectedFolderPath;
        expect(topoCli.initProject).toHaveBeenCalledWith(projectPath, 'my-project');
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
            'Project "my-project" initialized successfully.'
        );
    });

    it('shows error message if initProject throws', async () => {
        topoCli.initProject.mockRejectedValue(new Error('fail'));
        await projectInit.activate();
        await (vscode.commands.registerCommand as jest.Mock).mock.calls[0][1]();
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Failed to initialize project: fail'
        );
    });

    it('returns early if no folder is selected', async () => {
        (vscode.window.showOpenDialog as jest.Mock).mockResolvedValue(undefined);
        await projectInit.activate();
        await (vscode.commands.registerCommand as jest.Mock).mock.calls[0][1]();
        expect(topoCli.initProject).not.toHaveBeenCalled();
    });

    it('returns early if no project name is entered', async () => {
        (vscode.window.showInputBox as jest.Mock).mockResolvedValue(undefined);
        await projectInit.activate();
        await (vscode.commands.registerCommand as jest.Mock).mock.calls[0][1]();
        expect(topoCli.initProject).not.toHaveBeenCalled();
    });
});
