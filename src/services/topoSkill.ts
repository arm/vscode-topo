import os from 'node:os';
import * as vscode from 'vscode';
import { WrappedError } from '../errors/wrappedError';
import { ensureSkillLink, isSkillLink } from '../util/skillLink';
import { skillPaths } from '../util/skillPaths';
import { TopoSkillStatus } from '../util/types';

export const TOPO_SKILL_NAME = skillPaths.skillName;

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
    private readonly claudeSkillsDirectoryUri: vscode.Uri;
    private readonly claudeSkillUri: vscode.Uri;

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
            ...skillPaths.canonicalSkillsDirectory,
        );
        this.topoSkillsSubdirectory = vscode.Uri.joinPath(
            userHomeUri,
            ...skillPaths.canonicalSkillPath,
        );
        this.claudeSkillsDirectoryUri = vscode.Uri.joinPath(
            userHomeUri,
            ...skillPaths.claudeSkillsDirectory,
        );
        this.claudeSkillUri = vscode.Uri.joinPath(
            userHomeUri,
            ...skillPaths.claudeSkillPath,
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

        if (!rawStringsAreEqual(bundledSkill, installedSkill)) {
            return 'outdated';
        }

        return (await isSkillLink(
            this.topoSkillsSubdirectory.fsPath,
            this.claudeSkillUri.fsPath,
        ))
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
        await vscode.workspace.fs.createDirectory(
            this.claudeSkillsDirectoryUri,
        );
        await ensureSkillLink(
            this.topoSkillsSubdirectory.fsPath,
            this.claudeSkillUri.fsPath,
        );
        const status = await this.getStatus();
        if (status !== 'installed') {
            throw new WrappedError(
                'SKILL',
                `Skill installation verification failed: ${status}`,
            );
        }
    }
}
