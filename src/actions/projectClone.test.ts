import * as vscode from 'vscode';
import { mock } from 'vitest-mock-extended';
import { ProjectClone } from './projectClone';
import { TopoCli } from '../services/topoCli';
import { TargetModel } from '../models/targetModel';
import { WrappedError } from '../errors/wrappedError';
import { showAndLogError } from '../util/showAndLog';
import {
    cloneProject,
    getLocalSourcePath,
    promptForRemoteCloneSource,
} from '../util/projectClone';
import { TaskExecutor } from '../util/taskExecutor';

vi.mock('../util/showAndLog');
vi.mock('../util/projectClone');

const cloneProjectMock = vi.mocked(cloneProject);
const getLocalSourcePathMock = vi.mocked(getLocalSourcePath);
const promptForRemoteCloneSourceMock = vi.mocked(promptForRemoteCloneSource);

const localSourcePath = '/path/to/source';

function selectQuickPickItem(label: string): void {
    vi.mocked(vscode.window.showQuickPick).mockImplementationOnce(
        async (items) => {
            const resolvedItems = await items;
            const selectedItem = resolvedItems.find(
                (item) => item.label === label,
            );
            if (!selectedItem) {
                throw new Error(`Missing clone method: ${label}`);
            }
            return selectedItem;
        },
    );
}

describe('ProjectClone action', () => {
    let projectClone: ProjectClone;
    let targetModel: TargetModel;
    const topoCli = mock<TopoCli>();
    const taskExecutor = mock<TaskExecutor>();

    beforeEach(() => {
        vi.resetAllMocks();
        targetModel = new TargetModel();
        projectClone = new ProjectClone(topoCli, targetModel, taskExecutor);
    });

    describe('cloneCommandHandler', () => {
        it('returns early when no clone method is selected', async () => {
            vi.mocked(vscode.window.showQuickPick).mockResolvedValueOnce(
                undefined,
            );

            await projectClone.cloneCommandHandler();

            expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
                [
                    expect.objectContaining({
                        label: 'Remote Project',
                    }),
                    expect.objectContaining({
                        label: 'Local Project',
                    }),
                ],
                { placeHolder: 'Select a clone method' },
            );
            expect(cloneProjectMock).not.toHaveBeenCalled();
        });

        it('clones from a remote project when selected', async () => {
            selectQuickPickItem('Remote Project');
            promptForRemoteCloneSourceMock.mockResolvedValueOnce({
                type: 'git',
                url: 'https://example.com/virtual-bittermelon-peeler.git',
            });

            await projectClone.cloneCommandHandler();

            expect(cloneProjectMock).toHaveBeenCalledWith(taskExecutor, {
                type: 'git',
                url: 'https://example.com/virtual-bittermelon-peeler.git',
            });
        });

        it('clones from a local project when selected', async () => {
            getLocalSourcePathMock.mockResolvedValueOnce(localSourcePath);
            selectQuickPickItem('Local Project');

            await projectClone.cloneCommandHandler();

            expect(cloneProjectMock).toHaveBeenCalledWith(taskExecutor, {
                type: 'dir',
                path: localSourcePath,
            });
        });
    });

    describe('remoteCloneCommandHandler', () => {
        it('returns early when no remote source is selected', async () => {
            promptForRemoteCloneSourceMock.mockResolvedValueOnce(undefined);

            await projectClone.remoteCloneCommandHandler();

            expect(cloneProjectMock).not.toHaveBeenCalled();
        });

        it('clones the selected remote source for the selected target', async () => {
            targetModel.setSelected('me@example.com');
            const source = {
                type: 'git' as const,
                url: 'https://example.com/virtual-bittermelon-peeler.git',
            };
            promptForRemoteCloneSourceMock.mockResolvedValueOnce(source);

            await projectClone.remoteCloneCommandHandler();

            expect(promptForRemoteCloneSourceMock).toHaveBeenCalledWith(
                topoCli,
                'me@example.com',
            );
            expect(cloneProjectMock).toHaveBeenCalledWith(taskExecutor, source);
        });
    });

    describe('localCloneCommandHandler', () => {
        it('returns early when no folder is selected', async () => {
            getLocalSourcePathMock.mockResolvedValueOnce(undefined);

            await projectClone.localCloneCommandHandler();

            expect(cloneProjectMock).not.toHaveBeenCalled();
        });

        it('clones from the selected local folder', async () => {
            getLocalSourcePathMock.mockResolvedValueOnce(localSourcePath);

            await projectClone.localCloneCommandHandler();

            expect(cloneProjectMock).toHaveBeenCalledWith(taskExecutor, {
                type: 'dir',
                path: localSourcePath,
            });
        });
    });

    describe('clone error handling', () => {
        it('shows clone errors instead of throwing them', async () => {
            const error = new WrappedError('CLONE', 'task fail');
            promptForRemoteCloneSourceMock.mockResolvedValueOnce({
                type: 'git',
                url: 'https://example.com/virtual-bittermelon-peeler.git',
            });
            cloneProjectMock.mockRejectedValueOnce(error);

            await projectClone.remoteCloneCommandHandler();

            expect(showAndLogError).toHaveBeenCalledWith(
                'Failed to clone project',
                error,
            );
        });

        it('shows CLI errors from project lookup instead of throwing them, preserving log entries', async () => {
            const logs = [{ level: 'Error' as const, msg: 'lscpu not found' }];
            const error = new WrappedError('CLI', 'boom', logs);
            promptForRemoteCloneSourceMock.mockRejectedValueOnce(error);

            await projectClone.remoteCloneCommandHandler();

            expect(showAndLogError).toHaveBeenCalledWith(
                'Failed to clone project',
                expect.objectContaining({ code: 'CLI', logs }),
            );
        });

        it('propagates unrelated errors', async () => {
            const error = new Error('unexpected fail');
            getLocalSourcePathMock.mockRejectedValueOnce(error);

            await expect(
                projectClone.localCloneCommandHandler(),
            ).rejects.toThrow(error);

            expect(showAndLogError).not.toHaveBeenCalled();
        });
    });
});
