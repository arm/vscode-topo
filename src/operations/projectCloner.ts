import path from 'node:path';
import { WrappedError } from '../errors/wrappedError';
import { TOPO_TASK_TYPE } from '../manifest';
import {
    TaskCommand,
    type TaskDefinition,
    type TaskFactory,
} from '../tasks/taskFactory';
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
import { type Result, success } from '../util/result';

export class ProjectCloner {
    constructor(private readonly taskFactory: TaskFactory) {}

    public async clone(
        source: CloneSource,
        parameters: CloneParameters = {},
    ): Promise<Result<void>> {
        const destinationPath = await promptForDestinationPath();
        if (!destinationPath) {
            return success();
        }

        const defaultProjectNameResult = getDefaultProjectName(source);
        if (defaultProjectNameResult.kind === 'error') {
            return defaultProjectNameResult;
        }
        const projectName = await resolveProjectName(
            destinationPath,
            defaultProjectNameResult.value,
        );
        if (!projectName) {
            return success();
        }

        const repositoryPath = path.join(destinationPath, projectName);
        const [, ...args] = buildCloneArguments(
            source,
            repositoryPath,
            parameters,
        );
        const definition: TaskDefinition = {
            type: TOPO_TASK_TYPE,
            command: TaskCommand.Clone,
            args,
        };
        const cloneTask = this.taskFactory.createTask(
            `Clone ${projectName}`,
            definition,
        );
        try {
            await runTask(cloneTask);
        } catch (error) {
            return new WrappedError('CLONE', getErrorMessage(error), [], {
                cause: error,
            });
        }

        await promptToOpenFolder(repositoryPath);
        return success();
    }
}
