import os from 'node:os';
import path from 'node:path';
import * as vscode from 'vscode';
import { MockProxy, mock } from 'vitest-mock-extended';
import { WrappedError } from '../errors/wrappedError';
import {
    handleCompletedClone,
    promptForDestinationPath,
    resolveProjectName,
} from '../util/projectClone';
import { TaskExecutor } from '../util/taskExecutor';
import { ProjectCloner } from './projectCloner';

vi.mock('../util/projectClone');

const handleCompletedCloneMock = vi.mocked(handleCompletedClone);
const promptForDestinationPathMock = vi.mocked(promptForDestinationPath);
const resolveProjectNameMock = vi.mocked(resolveProjectName);

describe('ProjectCloner', () => {
    const destinationPath = path.resolve('home', 'destination');
    let taskExecutor: MockProxy<TaskExecutor>;
    let projectCloner: ProjectCloner;

    const expectCloneTask = (
        task: vscode.Task,
        projectName: string,
        args: string[],
    ): void => {
        expect(task.name).toBe(`Clone ${projectName}`);
        expect(task.execution).toMatchObject({
            process: 'topo',
            args,
            options: { cwd: os.homedir() },
        });
    };

    beforeEach(() => {
        vi.resetAllMocks();
        taskExecutor = mock<TaskExecutor>();
        promptForDestinationPathMock.mockResolvedValue(destinationPath);
        resolveProjectNameMock.mockResolvedValue('virtual-bittermelon-peeler');
        projectCloner = new ProjectCloner(taskExecutor);
    });

    it('stops when destination selection is cancelled', async () => {
        promptForDestinationPathMock.mockResolvedValueOnce(undefined);

        await projectCloner.clone({
            type: 'git',
            url: 'https://example.com/virtual-bittermelon-peeler.git',
        });

        expect(resolveProjectNameMock).not.toHaveBeenCalled();
        expect(taskExecutor.run).not.toHaveBeenCalled();
    });

    it('stops when project name selection is cancelled', async () => {
        resolveProjectNameMock.mockResolvedValueOnce(undefined);

        await projectCloner.clone({
            type: 'git',
            url: 'https://example.com/virtual-bittermelon-peeler.git',
        });

        expect(resolveProjectNameMock).toHaveBeenCalledWith(
            destinationPath,
            'virtual-bittermelon-peeler',
        );
        expect(taskExecutor.run).not.toHaveBeenCalled();
    });

    it.each(['../outside', '..\\outside'])(
        'rejects a project name that escapes the destination (%s)',
        async (projectName) => {
            resolveProjectNameMock.mockResolvedValueOnce(projectName);

            await expect(
                projectCloner.clone({
                    type: 'git',
                    url: 'https://example.com/virtual-bittermelon-peeler.git',
                }),
            ).rejects.toEqual(
                expect.objectContaining({
                    code: 'CLONE',
                    message:
                        'Project name must be a single folder name, not a path.',
                }),
            );
            expect(taskExecutor.run).not.toHaveBeenCalled();
        },
    );

    it('runs a clone task and then offers the post-clone action', async () => {
        await projectCloner.clone({
            type: 'git',
            url: 'https://example.com/virtual-bittermelon-peeler.git',
        });

        const repositoryPath = path.join(
            destinationPath,
            'virtual-bittermelon-peeler',
        );
        expectCloneTask(
            taskExecutor.run.mock.calls[0][0],
            'virtual-bittermelon-peeler',
            [
                'clone',
                'git:https://example.com/virtual-bittermelon-peeler.git',
                repositoryPath,
            ],
        );
        expect(handleCompletedCloneMock).toHaveBeenCalledWith(repositoryPath);
    });

    it('passes raw sources and clone parameters to the task', async () => {
        await projectCloner.clone(
            {
                value: 'https://example.com/virtual-bittermelon-peeler.git',
            },
            { model: 'some-huggingface-id' },
        );

        expectCloneTask(
            taskExecutor.run.mock.calls[0][0],
            'virtual-bittermelon-peeler',
            [
                'clone',
                'https://example.com/virtual-bittermelon-peeler.git',
                path.join(destinationPath, 'virtual-bittermelon-peeler'),
                'model=some-huggingface-id',
            ],
        );
    });

    it('wraps task errors and skips prompting to open clone result folder', async () => {
        const error = new Error('task fail');
        taskExecutor.run.mockRejectedValueOnce(error);

        await expect(
            projectCloner.clone({
                type: 'git',
                url: 'https://example.com/virtual-bittermelon-peeler.git',
            }),
        ).rejects.toEqual(
            expect.objectContaining({
                code: 'CLONE',
                message: error.message,
                cause: error,
            }),
        );
        expect(handleCompletedCloneMock).not.toHaveBeenCalled();
    });

    it('rejects invalid source URLs before executing a task', async () => {
        await expect(
            projectCloner.clone({
                type: 'git',
                url: 'not-a-valid-url',
            }),
        ).rejects.toBeInstanceOf(WrappedError);
        expect(taskExecutor.run).not.toHaveBeenCalled();
    });
});
