import os from 'node:os';
import * as vscode from 'vscode';
import { TopoSkillStatus } from '../util/types';
import { WrappedError } from '../errors/wrappedError';

export const TOPO_SKILL_NAME = 'topo-cli-location';

const SKILL_FILE_NAME = 'SKILL.md';

function isFileNotFound(error: unknown): boolean {
    return (
        error instanceof vscode.FileSystemError && error.code === 'FileNotFound'
    );
}

function rawStringsAreEqual(first: Uint8Array, second: Uint8Array): boolean {
    return Buffer.from(first).equals(Buffer.from(second));
}

export class TopoSkill {
    private readonly bundledDirectoryUri: vscode.Uri;
    private readonly skillsDirectoryUri: vscode.Uri;
    private readonly topoSkillsSubdirectory: vscode.Uri;

    constructor(
        extensionUri: vscode.Uri,
        userHomeUri = vscode.Uri.file(os.homedir()),
    ) {
        this.bundledDirectoryUri = vscode.Uri.joinPath(
            extensionUri,
            'skills',
            TOPO_SKILL_NAME,
        );
        this.skillsDirectoryUri = vscode.Uri.joinPath(
            userHomeUri,
            '.agents',
            'skills',
        );
        this.topoSkillsSubdirectory = vscode.Uri.joinPath(
            this.skillsDirectoryUri,
            TOPO_SKILL_NAME,
        );
    }

    public async getStatus(): Promise<TopoSkillStatus> {
        const bundledSkill = await vscode.workspace.fs.readFile(
            vscode.Uri.joinPath(this.bundledDirectoryUri, SKILL_FILE_NAME),
        );

        let installedSkill: Uint8Array;
        try {
            installedSkill = await vscode.workspace.fs.readFile(
                vscode.Uri.joinPath(
                    this.topoSkillsSubdirectory,
                    SKILL_FILE_NAME,
                ),
            );
        } catch (error) {
            if (isFileNotFound(error)) {
                return 'missing';
            }
            throw error;
        }

        return rawStringsAreEqual(bundledSkill, installedSkill)
            ? 'installed'
            : 'outdated';
    }

    public async install(): Promise<void> {
        await vscode.workspace.fs.createDirectory(this.skillsDirectoryUri);
        await vscode.workspace.fs.copy(
            this.bundledDirectoryUri,
            this.topoSkillsSubdirectory,
            { overwrite: true },
        );
        const status = await this.getStatus();
        if (status !== 'installed') {
            throw new WrappedError(
                'SKILL',
                `Skill installation verification failed: ${status}`,
            );
        }
    }

    public async uninstall(): Promise<void> {
        try {
            await vscode.workspace.fs.delete(this.topoSkillsSubdirectory, {
                recursive: true,
            });
        } catch (error) {
            if (!isFileNotFound(error)) {
                throw error;
            }
        }

        const status = await this.getStatus();
        if (status !== 'missing') {
            throw new WrappedError(
                'SKILL',
                `Skill uninstallation verification failed: ${status}`,
            );
        }
    }
}
