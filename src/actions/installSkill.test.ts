import { createRequire } from 'node:module';
import * as vscode from 'vscode';
import { mock } from 'vitest-mock-extended';
import { InstallSkill } from './installSkill';
import { TopoSkill } from '../services/topoSkill';
import { refreshSkillStatus } from '../commandIds';

type Remove = (
    path: string,
    options: { recursive: boolean; force: boolean },
) => void;

const loadModule = createRequire(__filename);
const { uninstallSkill } = loadModule('../../scripts/uninstall.cjs') as {
    uninstallSkill(userHome: string, remove: Remove): void;
};

describe('InstallSkill', () => {
    const userHomeUri = vscode.Uri.file('/fake/home');

    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('installs the bundled skill for the current user', async () => {
        const topoSkill = mock<TopoSkill>();
        const action = new InstallSkill(topoSkill);

        await action.installSkillCommandHandler();

        expect(topoSkill.install).toHaveBeenCalledOnce();
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            refreshSkillStatus,
        );
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
            'Topo CLI location skill installed. Start a new agent session to check it out',
        );
    });

    it('removes the installed skill on uninstall', () => {
        const remove = vi.fn<Remove>();

        uninstallSkill(userHomeUri.fsPath, remove);

        expect(remove).toHaveBeenCalledExactlyOnceWith(
            vscode.Uri.joinPath(
                userHomeUri,
                '.agents',
                'skills',
                'topo-cli-location',
            ).fsPath,
            {
                recursive: true,
                force: true,
            },
        );
    });
});
