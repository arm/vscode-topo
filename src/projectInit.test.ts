import * as vscode from 'vscode';
import { ProjectInit } from './projectInit';
import { Target } from './workloadPlacement/target';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('vscode');

describe('ProjectInit', () => {
    let context: { subscriptions: any[] };
    let topoCli: { init: jest.Mock };
    const target = new Target('target-1', 'root@something.local');
    const targetStore = {
        getSelectedTarget: jest.fn().mockResolvedValue(target),
    };
    let projectInit: ProjectInit;
    const workspacePath = '/fake/workspace';

    beforeEach(() => {
        context = { subscriptions: [] };
        topoCli = { init: jest.fn() };
        jest.clearAllMocks();
        (vscode.commands.registerCommand as jest.Mock).mockImplementation((_cmd, cb) => cb);
        (vscode.window.showInformationMessage as jest.Mock).mockImplementation(jest.fn());
        (vscode.window.showErrorMessage as jest.Mock).mockImplementation(jest.fn());
        projectInit = new ProjectInit(context, topoCli, targetStore);
    });

    it('registers the initProject command on activate', async () => {

        await projectInit.activate();

        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            ProjectInit.initProjectCommand,
            expect.any(Function)
        );
    });

    it('calls topoCli.init with currently opened workspace path', async () => {

        (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: workspacePath } }];
        await projectInit.activate();

        await (vscode.commands.registerCommand as jest.Mock).mock.calls[0][1]();

        expect(topoCli.init).toHaveBeenCalledWith(workspacePath, target.ssh);
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
            'Project initialized successfully.'
        );
    });

    it('shows error message if topoCli.init throws', async () => {
        topoCli.init.mockRejectedValue(new Error('fail'));
        await projectInit.activate();

        await (vscode.commands.registerCommand as jest.Mock).mock.calls[0][1]();

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Failed to initialize project: fail'
        );
    });

    it('does not attempt init and shows an error when there is no selected target', async () => {
        const noTargetStore = { getSelectedTarget: jest.fn().mockResolvedValue(undefined) };
        projectInit = new ProjectInit(context, topoCli, noTargetStore as any);
        (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: workspacePath } }];
        await projectInit.activate();

        await (vscode.commands.registerCommand as jest.Mock).mock.calls[0][1]();

        expect(topoCli.init).not.toHaveBeenCalled();
        expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });
});
