import * as vscode from 'vscode';
import { MakefileGenerator } from './makefileGenerator';
import * as manifest from './manifest';
import path from 'path';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('vscode');

describe('MakefileGenerator', () => {
    let context: { subscriptions: any[] };
    let topoCli: { generateMakefile: jest.Mock };
    let makefileGenerator: MakefileGenerator;
    const selectedFolderPath = '/folder';
    const composeFileName = manifest.BOARD_DEFAULT_COMPOSE_FILE;
    const composeFilePath = path.join(selectedFolderPath, composeFileName);

    beforeEach(() => {
        context = { subscriptions: [] };
        topoCli = { generateMakefile: jest.fn() };
        jest.clearAllMocks();
        (vscode.commands.registerCommand as jest.Mock).mockImplementation((_cmd, cb) => cb);
        (vscode.window.showOpenDialog as jest.Mock).mockResolvedValue([{ fsPath: selectedFolderPath }]);
        (vscode.window.showInformationMessage as jest.Mock).mockImplementation(jest.fn());
        (vscode.window.showErrorMessage as jest.Mock).mockImplementation(jest.fn());
        makefileGenerator = new MakefileGenerator(context as any, topoCli as any);
    });

    it('registers the generateMakefile and context commands on activate', async () => {
        await makefileGenerator.activate();
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            MakefileGenerator.generateMakefileCommand,
            expect.any(Function)
        );
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            `${MakefileGenerator.generateMakefileCommand}.context`,
            expect.any(Function)
        );
    });

    it('calls topoCli.generateMakefile with correct arguments from palette', async () => {
        await makefileGenerator.activate();
        await (vscode.commands.registerCommand as jest.Mock).mock.calls[0][1]();
        expect(topoCli.generateMakefile).toHaveBeenCalledWith(composeFilePath);
    });

    it('calls topoCli.generateMakefile with correct arguments from context menu', async () => {
        await makefileGenerator.activate();
        const fileUri = { fsPath: '/folder/compose.topo.yaml' } as vscode.Uri;
        await (vscode.commands.registerCommand as jest.Mock).mock.calls[1][1](fileUri);
        expect(topoCli.generateMakefile).toHaveBeenCalledWith(fileUri.fsPath);
    });

    it('shows error message if generateMakefile throws', async () => {
        topoCli.generateMakefile.mockRejectedValue(new Error('fail'));
        await makefileGenerator.activate();
        await (vscode.commands.registerCommand as jest.Mock).mock.calls[0][1]();
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Failed to generate Makefile: fail'
        );
    });

    it('returns early if no folder is selected', async () => {
        (vscode.window.showOpenDialog as jest.Mock).mockResolvedValue(undefined);
        await makefileGenerator.activate();
        await (vscode.commands.registerCommand as jest.Mock).mock.calls[0][1]();
        expect(topoCli.generateMakefile).not.toHaveBeenCalled();
    });
});
