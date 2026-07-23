import fs from 'node:fs';
import * as vscode from 'vscode';
import { InstallSkill, installSkill } from './installSkill';

vi.mock('node:fs', () => ({
    default: {
        existsSync: vi.fn(),
    },
}));

describe('InstallSkill', () => {
    const extensionUri = vscode.Uri.file('/fake/extension');
    const userHomeUri = vscode.Uri.file('/fake/home');

    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('installs the bundled skill for the current user', async () => {
        vi.mocked(fs.existsSync).mockReturnValueOnce(false);

        await installSkill(extensionUri, userHomeUri);

        expect(vscode.workspace.fs.copy).toHaveBeenCalledOnce();
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
            'Topo skill installed. Start a new agent session if it is not available immediately.',
        );
    });

    it('asks before replacing an existing installation', async () => {
        vi.mocked(fs.existsSync).mockReturnValueOnce(true);
        vi.mocked(vscode.window.showWarningMessage).mockResolvedValueOnce(
            'Replace' as unknown as vscode.MessageItem,
        );

        await installSkill(extensionUri, userHomeUri);

        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            'The Topo skill is already installed. Replace it with the bundled version?',
            { modal: true },
            'Replace',
        );
        expect(vscode.workspace.fs.copy).toHaveBeenCalledOnce();
    });

    it('keeps an existing installation when replacement is dismissed', async () => {
        vi.mocked(fs.existsSync).mockReturnValueOnce(true);
        vi.mocked(vscode.window.showWarningMessage).mockResolvedValueOnce(
            undefined,
        );

        await installSkill(extensionUri, userHomeUri);

        expect(vscode.workspace.fs.copy).not.toHaveBeenCalled();
    });

    it('reports installation failures from the command handler', async () => {
        const error = new Error('permission denied');
        vi.mocked(fs.existsSync).mockReturnValueOnce(false);
        vi.mocked(vscode.workspace.fs.copy).mockRejectedValueOnce(error);
        const action = new InstallSkill(extensionUri, userHomeUri);

        await action.installSkillCommandHandler();

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Failed to install the Topo skill. permission denied',
        );
    });
});
