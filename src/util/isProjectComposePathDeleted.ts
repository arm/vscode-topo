import path from 'node:path';
import { ProjectMetadata } from './project';

export function isProjectComposePathDeleted(
    projects: ProjectMetadata[],
    deletedPath: string,
): boolean {
    return projects.some((project) => {
        const relativePath = path.relative(
            deletedPath,
            project.composeFileUri.fsPath,
        );
        return (
            relativePath !== '..' &&
            !relativePath.startsWith(`..${path.sep}`) &&
            !path.isAbsolute(relativePath)
        );
    });
}
