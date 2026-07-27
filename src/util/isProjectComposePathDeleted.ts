import path from 'node:path';
import { ProjectMetadata } from './project';
import { DeepReadonly } from './types';

export function isProjectComposePathDeleted(
    projects: DeepReadonly<ProjectMetadata[]>,
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
