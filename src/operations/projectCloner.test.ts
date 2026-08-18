import path from 'node:path';
import * as vscode from 'vscode';
import { MockProxy, mock } from 'vitest-mock-extended';
import { WrappedError } from '../errors/wrappedError';
import { TOPO_TASK_TYPE } from '../manifest';
import { TaskCommand } from '../tasks/taskFactory';
import {
    promptForDestinationPath,
    promptToOpenFolder,
    resolveProjectName,
} from '../util/projectClone';
import { runTask } from '../util/task';
import type { TaskFactory } from '../tasks/taskFactory';
import { ProjectCloner } from './projectCloner';

vi.mock('../util/projectClone');
vi.mock('../util/task');

const promptForDestinationPathMock = vi.mocked(promptForDestinationPath);
const promptToOpenFolderMock = vi.mocked(promptToOpenFolder);
const resolveProjectNameMock = vi.mocked(resolveProjectName);
const mockRunTask = vi.mocked(runTask);

describe('ProjectCloner', () => {
    const destinationPath = path.resolve('home', 'destination');
    const task = new vscode.Task(
        { type: 'process' },
        vscode.TaskScope.Workspace,
        'Clone task',
        'topo',
    );
    let taskFactory: MockProxy<TaskFactory>;
    let projectCloner: ProjectCloner;

    const expectCloneTask = (projectName: string, args: string[]): void => {
        expect(taskFactory.createTask).toHaveBeenCalledWith(
            `Clone ${projectName}`,
            {
                type: TOPO_TASK_TYPE,
                command: TaskCommand.Clone,
                args,
            },
        );
        expect(mockRunTask).toHaveBeenCalledWith(task);
    };

    beforeEach(() => {
        vi.resetAllMocks();
        taskFactory = mock<TaskFactory>();
        taskFactory.createTask.mockReturnValue(task);
        promptForDestinationPathMock.mockResolvedValue(destinationPath);
        resolveProjectNameMock.mockResolvedValue('virtual-bittermelon-peeler');
        projectCloner = new ProjectCloner(taskFactory);
    });

    it('stops when destination selection is cancelled', async () => {
        promptForDestinationPathMock.mockResolvedValueOnce(undefined);

        await projectCloner.clone({
            type: 'git',
            url: 'https://example.com/virtual-bittermelon-peeler.git',
        });

        expect(resolveProjectNameMock).not.toHaveBeenCalled();
        expect(mockRunTask).not.toHaveBeenCalled();
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
        expect(mockRunTask).not.toHaveBeenCalled();
    });

    it('runs a clone task and then offers the post-clone action', async () => {
        await projectCloner.clone({
            type: 'git',
            url: 'https://example.com/virtual-bittermelon-peeler.git',
        });

        const repositoryPath = path.join(
            destinationPath,
            'virtual-bittermelon-peeler',
        );
        expectCloneTask('virtual-bittermelon-peeler', [
            'git:https://example.com/virtual-bittermelon-peeler.git',
            repositoryPath,
        ]);
        expect(promptToOpenFolderMock).toHaveBeenCalledWith(repositoryPath);
    });

    it('passes raw sources and clone parameters to the task', async () => {
        await projectCloner.clone(
            {
                value: 'https://example.com/virtual-bittermelon-peeler.git',
            },
            { model: 'some-huggingface-id' },
        );

        expectCloneTask('virtual-bittermelon-peeler', [
            'https://example.com/virtual-bittermelon-peeler.git',
            path.join(destinationPath, 'virtual-bittermelon-peeler'),
            'model=some-huggingface-id',
        ]);
    });

    it('wraps task errors and skips prompting to open clone result folder', async () => {
        const error = new Error('task fail');
        mockRunTask.mockRejectedValueOnce(error);

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
        expect(promptToOpenFolderMock).not.toHaveBeenCalled();
    });

    it('rejects invalid source URLs before executing a task', async () => {
        await expect(
            projectCloner.clone({
                type: 'git',
                url: 'not-a-valid-url',
            }),
        ).rejects.toBeInstanceOf(WrappedError);
        expect(mockRunTask).not.toHaveBeenCalled();
    });
});
