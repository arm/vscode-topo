import { createRequire } from 'node:module';
import * as vscode from 'vscode';
import { mock } from 'vitest-mock-extended';
import { refreshSkillStatus } from '../commandIds';
import { TopoSkill } from '../services/topoSkill';
import { InstallSkill } from './installSkill';

type Remove = (
    path: string,
    options: { recursive: boolean; force: boolean },
) => void;
type LinkStatus = (path: string) => { isSymbolicLink(): boolean };
type ReadLink = (path: string) => string;

const loadModule = createRequire(__filename);
const { uninstallSkill } = loadModule('../../scripts/uninstall.cjs') as {
    uninstallSkill(
        userHome: string,
        remove: Remove,
        linkStatus: LinkStatus,
        readLink: ReadLink,
    ): void;
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
            'Topo CLI location skill installed for Codex and Claude Code. Start a new agent session to check it out.',
        );
    });

    it('removes the installed skill on uninstall', () => {
        const remove = vi.fn<Remove>();
        const skillPath = vscode.Uri.joinPath(
            userHomeUri,
            '.agents',
            'skills',
            'topo-cli-location',
        ).fsPath;
        const claudeSkillPath = vscode.Uri.joinPath(
            userHomeUri,
            '.claude',
            'skills',
            'topo-cli-location',
        ).fsPath;

        uninstallSkill(
            userHomeUri.fsPath,
            remove,
            () => ({ isSymbolicLink: () => true }),
            () => skillPath,
        );

        expect(remove).toHaveBeenNthCalledWith(1, claudeSkillPath, {
            recursive: true,
            force: true,
        });
        expect(remove).toHaveBeenNthCalledWith(2, skillPath, {
            recursive: true,
            force: true,
        });
    });

    it('preserves a non-link Claude skill during uninstall', () => {
        const remove = vi.fn<Remove>();

        uninstallSkill(
            userHomeUri.fsPath,
            remove,
            () => ({ isSymbolicLink: () => false }),
            vi.fn(),
        );

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

    it('ignores a missing Claude skill link during uninstall', () => {
        const remove = vi.fn<Remove>();
        const missingLinkError = Object.assign(new Error('missing link'), {
            code: 'ENOENT',
        });

        uninstallSkill(
            userHomeUri.fsPath,
            remove,
            () => {
                throw missingLinkError;
            },
            vi.fn(),
        );

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
