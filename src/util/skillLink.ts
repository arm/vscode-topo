import { lstat, mkdir, readlink, symlink, unlink } from 'node:fs/promises';
import path from 'node:path';
import { WrappedError } from '../errors/wrappedError';

type ExistingPath =
    | { type: 'missing' }
    | { type: 'non-link' }
    | { type: 'link'; target: string };

export async function isSkillLink(
    targetPath: string,
    linkPath: string,
): Promise<boolean> {
    const existingPath = await getExistingPath(linkPath);
    return (
        existingPath.type === 'link' &&
        linkTargetsPath(existingPath.target, targetPath, linkPath)
    );
}

export async function ensureSkillLink(
    targetPath: string,
    linkPath: string,
): Promise<void> {
    const existingPath = await getExistingPath(linkPath);
    if (existingPath.type === 'non-link') {
        throw new WrappedError(
            'SKILL',
            `Cannot link the Topo skill because ${linkPath} already exists and is not a symbolic link`,
        );
    }
    if (existingPath.type === 'link') {
        if (linkTargetsPath(existingPath.target, targetPath, linkPath)) {
            return;
        }
        await unlink(linkPath);
    }

    const linkTarget =
        process.platform === 'win32'
            ? path.resolve(targetPath)
            : path.relative(path.dirname(linkPath), targetPath);
    await mkdir(path.dirname(linkPath), { recursive: true });
    await symlink(
        linkTarget,
        linkPath,
        process.platform === 'win32' ? 'junction' : 'dir',
    );
}

function linkTargetsPath(
    existingTarget: string,
    targetPath: string,
    linkPath: string,
): boolean {
    return (
        path.resolve(path.dirname(linkPath), existingTarget) ===
        path.resolve(targetPath)
    );
}

async function getExistingPath(linkPath: string): Promise<ExistingPath> {
    let linkStats;
    try {
        linkStats = await lstat(linkPath);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return { type: 'missing' };
        }
        throw error;
    }

    if (!linkStats.isSymbolicLink()) {
        return { type: 'non-link' };
    }
    return { type: 'link', target: await readlink(linkPath) };
}
