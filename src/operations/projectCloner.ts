import path from 'node:path';
import { WrappedError } from '../errors/wrappedError';
import {
    buildCloneArguments,
    CloneParameters,
    CloneSource,
    getDefaultProjectName,
} from '../util/cloneSource';
import { getErrorMessage } from '../util/getErrorMessage';
import {
    promptForDestinationPath,
    promptToOpenFolder,
    resolveProjectName,
} from '../util/projectClone';
import { runTask } from '../util/task';
import type { TaskFactory } from '../tasks/taskFactory';

export class ProjectCloner {
    constructor(private readonly taskFactory: TaskFactory) {}

    public async clone(
        source: CloneSource,
        parameters: CloneParameters = {},
    ): Promise<void> {
        const destinationPath = await promptForDestinationPath();
        if (!destinationPath) {
            return;
        }

        const projectName = await resolveProjectName(
            destinationPath,
            getDefaultProjectName(source),
        );
        if (!projectName) {
            return;
        }

        const repositoryPath = path.join(destinationPath, projectName);
        const cloneTask = this.taskFactory.createProcessTask(
            `Clone ${projectName}`,
            [
                'topo',
                ...buildCloneArguments(source, repositoryPath, parameters),
            ],
        );
        try {
            await runTask(cloneTask);
        } catch (error) {
            throw new WrappedError('CLONE', getErrorMessage(error), [], {
                cause: error,
            });
        }

        await promptToOpenFolder(repositoryPath);
    }
}
