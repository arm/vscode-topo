import * as vscode from 'vscode';
import { ensureSkillLink, isSkillLink } from '../util/skillLink';
import { TopoSkill } from './topoSkill';

vi.mock('../util/skillLink');

describe('TopoSkill', () => {
    const extensionUri = vscode.Uri.file('/fake/extension');
    const userHomeUri = vscode.Uri.file('/fake/home');

    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(isSkillLink).mockResolvedValue(true);
    });

    it('reports an installed skill when the skill files match', async () => {
        vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(
            Uint8Array.from([1, 2, 3]),
        );
        const topoSkill = new TopoSkill(extensionUri, userHomeUri);

        await expect(topoSkill.getStatus()).resolves.toBe('installed');
    });

    it('reports a missing skill when the installed skill file does not exist', async () => {
        vi.mocked(vscode.workspace.fs.readFile)
            .mockResolvedValueOnce(Uint8Array.from([1, 2, 3]))
            .mockRejectedValueOnce(
                vscode.FileSystemError.FileNotFound('SKILL.md'),
            );
        const topoSkill = new TopoSkill(extensionUri, userHomeUri);

        await expect(topoSkill.getStatus()).resolves.toBe('missing');
    });

    it('reports an outdated skill when the installed skill file differs', async () => {
        vi.mocked(vscode.workspace.fs.readFile)
            .mockResolvedValueOnce(Uint8Array.from([1, 2, 3]))
            .mockResolvedValueOnce(Uint8Array.from([1, 2, 4]));
        const topoSkill = new TopoSkill(extensionUri, userHomeUri);

        await expect(topoSkill.getStatus()).resolves.toBe('outdated');
    });

    it('reports an outdated skill when the Claude skill link is missing', async () => {
        vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(
            Uint8Array.from([1, 2, 3]),
        );
        vi.mocked(isSkillLink).mockResolvedValue(false);
        const topoSkill = new TopoSkill(extensionUri, userHomeUri);

        await expect(topoSkill.getStatus()).resolves.toBe('outdated');
    });

    it('installs the bundled skill', async () => {
        vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(
            Uint8Array.from([1, 2, 3]),
        );
        const topoSkill = new TopoSkill(extensionUri, userHomeUri);

        await topoSkill.install();

        expect(vscode.workspace.fs.createDirectory).toHaveBeenCalledWith(
            vscode.Uri.joinPath(userHomeUri, '.agents', 'skills'),
        );
        expect(vscode.workspace.fs.copy).toHaveBeenCalledWith(
            vscode.Uri.joinPath(extensionUri, 'skills', 'topo-cli-location'),
            expect.objectContaining({
                path: '/fake/home/.agents/skills/topo-cli-location',
            }),
            { overwrite: true },
        );
        expect(vscode.workspace.fs.createDirectory).toHaveBeenCalledWith(
            vscode.Uri.joinPath(userHomeUri, '.claude', 'skills'),
        );
        expect(ensureSkillLink).toHaveBeenCalledWith(
            vscode.Uri.joinPath(
                userHomeUri,
                '.agents',
                'skills',
                'topo-cli-location',
            ).fsPath,
            vscode.Uri.joinPath(
                userHomeUri,
                '.claude',
                'skills',
                'topo-cli-location',
            ).fsPath,
        );
    });
});
