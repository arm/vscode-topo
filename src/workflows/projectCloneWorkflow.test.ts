import os from 'node:os';
import path from 'node:path';
import * as vscode from 'vscode';
import { MockProxy, mock } from 'vitest-mock-extended';
import { WrappedError } from '../errors/wrappedError';
import { TaskExecutor } from '../util/taskExecutor';
import {
    ProjectCloneInteraction,
    ProjectCloneWorkflow,
} from './projectCloneWorkflow';

describe('ProjectCloneWorkflow', () => {
    const destinationPath = path.resolve('home', 'destination');
    let taskExecutor: MockProxy<TaskExecutor>;
    let interaction: MockProxy<ProjectCloneInteraction>;
    let workflow: ProjectCloneWorkflow;

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
        taskExecutor = mock<TaskExecutor>();
        interaction = mock<ProjectCloneInteraction>();
        interaction.selectDestinationPath.mockResolvedValue(destinationPath);
        interaction.resolveProjectName.mockResolvedValue(
            'virtual-bittermelon-peeler',
        );
        workflow = new ProjectCloneWorkflow(taskExecutor, interaction);
    });

    it('stops when destination selection is cancelled', async () => {
        interaction.selectDestinationPath.mockResolvedValueOnce(undefined);

        await workflow.clone({
            type: 'git',
            url: 'https://example.com/virtual-bittermelon-peeler.git',
        });

        expect(interaction.resolveProjectName).not.toHaveBeenCalled();
        expect(taskExecutor.run).not.toHaveBeenCalled();
    });

    it('stops when project name selection is cancelled', async () => {
        interaction.resolveProjectName.mockResolvedValueOnce(undefined);

        await workflow.clone({
            type: 'git',
            url: 'https://example.com/virtual-bittermelon-peeler.git',
        });

        expect(interaction.resolveProjectName).toHaveBeenCalledWith(
            destinationPath,
            'virtual-bittermelon-peeler',
        );
        expect(taskExecutor.run).not.toHaveBeenCalled();
    });

    it.each(['../outside', '..\\outside'])(
        'rejects a project name that escapes the destination (%s)',
        async (projectName) => {
            interaction.resolveProjectName.mockResolvedValueOnce(projectName);

            await expect(
                workflow.clone({
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
        await workflow.clone({
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
        expect(interaction.handleCompletedClone).toHaveBeenCalledWith(
            repositoryPath,
        );
    });

    it('passes raw sources and clone parameters to the task', async () => {
        await workflow.clone(
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

    it('wraps task errors and skips the post-clone action', async () => {
        const error = new Error('task fail');
        taskExecutor.run.mockRejectedValueOnce(error);

        await expect(
            workflow.clone({
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
        expect(interaction.handleCompletedClone).not.toHaveBeenCalled();
    });

    it('rejects invalid source URLs before executing a task', async () => {
        await expect(
            workflow.clone({
                type: 'git',
                url: 'not-a-valid-url',
            }),
        ).rejects.toBeInstanceOf(WrappedError);
        expect(taskExecutor.run).not.toHaveBeenCalled();
    });
});
