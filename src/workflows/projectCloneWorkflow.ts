import path from 'node:path';
import { WrappedError } from '../errors/wrappedError';
import {
    buildCloneArguments,
    CloneParameters,
    CloneSource,
    getDefaultProjectName,
    validateProjectName,
} from '../util/cloneSource';
import { getErrorMessage } from '../util/getErrorMessage';
import { createProcessTask } from '../util/task';
import { TaskExecutor } from '../util/taskExecutor';

export interface ProjectCloneInteraction {
    selectDestinationPath(): Promise<string | undefined>;
    resolveProjectName(
        destinationPath: string,
        defaultProjectName: string,
    ): Promise<string | undefined>;
    handleCompletedClone(repositoryPath: string): Promise<void>;
}

export class ProjectCloneWorkflow {
    constructor(
        private readonly taskExecutor: TaskExecutor,
        private readonly interaction: ProjectCloneInteraction,
    ) {}

    public async clone(
        source: CloneSource,
        parameters: CloneParameters = {},
    ): Promise<void> {
        const destinationPath = await this.interaction.selectDestinationPath();
        if (!destinationPath) {
            return;
        }

        const projectName = await this.interaction.resolveProjectName(
            destinationPath,
            getDefaultProjectName(source),
        );
        if (!projectName) {
            return;
        }

        const validationError = validateProjectName(projectName);
        if (validationError) {
            throw new WrappedError('CLONE', validationError);
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

        await this.interaction.handleCompletedClone(repositoryPath);
    }
}
