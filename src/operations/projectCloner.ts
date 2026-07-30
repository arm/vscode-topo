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
import { createProcessTask } from '../util/task';
import { TaskExecutor } from '../util/taskExecutor';

export class ProjectCloner {
    constructor(private readonly taskExecutor: TaskExecutor) {}

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
        const cloneTask = createProcessTask(`Clone ${projectName}`, [
            'topo',
            ...buildCloneArguments(source, repositoryPath, parameters),
        ]);
        try {
            await this.taskExecutor.run(cloneTask);
        } catch (error) {
            throw new WrappedError('CLONE', getErrorMessage(error), [], {
                cause: error,
            });
        }

        await promptToOpenFolder(repositoryPath);
    }
}
