import * as vscode from 'vscode';
import { mock } from 'vitest-mock-extended';
import { ProjectClone } from './projectClone';
import { TopoCli } from '../topoCli';
import { TargetModel } from '../models/targetModel';
import { TemplateDescription } from '../topoCliSchema';
import { WrappedError } from '../errors/wrappedError';
import { showAndLogError } from '../util/showAndLogError';
import {
    cloneProjectFromSource,
    getLocalSourcePath,
    getTemplateOfChoice,
} from '../util/projectClone';
import { TaskExecutor } from '../util/taskExecutor';

vi.mock('../util/showAndLogError');
vi.mock('../util/projectClone');

const cloneProjectFromSourceMock = vi.mocked(cloneProjectFromSource);
const getLocalSourcePathMock = vi.mocked(getLocalSourcePath);
const getTemplateOfChoiceMock = vi.mocked(getTemplateOfChoice);

const localSourcePath = '/path/to/source';
const selectedTemplate: TemplateDescription = {
    name: 'template-alpha',
    url: 'https://example.com/templates/template-alpha.git',
    description: 'Template Apple description.',
    ref: 'r',
    features: [],
};

function selectQuickPickItem(label: string): void {
    vi.mocked(vscode.window.showQuickPick).mockImplementationOnce(((
        items: readonly vscode.QuickPickItem[],
    ) => {
        const selectedItem = items.find((item) => item.label === label);
        if (!selectedItem) {
            throw new Error(`Missing clone method: ${label}`);
        }
        return Promise.resolve(selectedItem);
    }) as never);
}

describe('ProjectClone action', () => {
    let projectClone: ProjectClone;
    let targetModel: TargetModel;
    const topoCli = mock<TopoCli>();
    const taskExecutor = mock<TaskExecutor>();

    beforeEach(() => {
        vi.resetAllMocks();
        cloneProjectFromSourceMock.mockResolvedValue(true);
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
                        label: 'Template Project',
                    }),
                    expect.objectContaining({
                        label: 'Local Project',
                    }),
                ],
                { placeHolder: 'Select a clone method' },
            );
            expect(cloneProjectFromSourceMock).not.toHaveBeenCalled();
        });

        it('clones from a remote project when selected', async () => {
            selectQuickPickItem('Remote Project');
            vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
                'https://example.com/repo.git',
            );

            await projectClone.cloneCommandHandler();

            expect(cloneProjectFromSourceMock).toHaveBeenCalledWith(
                taskExecutor,
                {
                    type: 'git',
                    url: 'https://example.com/repo.git',
                },
            );
        });

        it('clones from a template project when selected', async () => {
            targetModel.setSelected('me@example.com');
            getTemplateOfChoiceMock.mockResolvedValueOnce(selectedTemplate);
            selectQuickPickItem('Template Project');

            await projectClone.cloneCommandHandler();

            expect(getTemplateOfChoiceMock).toHaveBeenCalledWith(
                topoCli,
                'me@example.com',
            );
            expect(cloneProjectFromSourceMock).toHaveBeenCalledWith(
                taskExecutor,
                {
                    type: 'git',
                    url: selectedTemplate.url,
                },
            );
        });

        it('clones from a local project when selected', async () => {
            getLocalSourcePathMock.mockResolvedValueOnce(localSourcePath);
            selectQuickPickItem('Local Project');

            await projectClone.cloneCommandHandler();

            expect(cloneProjectFromSourceMock).toHaveBeenCalledWith(
                taskExecutor,
                {
                    type: 'dir',
                    path: localSourcePath,
                },
            );
        });
    });

    describe('remoteCloneCommandHandler', () => {
        it('returns early when no clone url is provided', async () => {
            vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
                undefined,
            );

            await projectClone.remoteCloneCommandHandler();

            expect(cloneProjectFromSourceMock).not.toHaveBeenCalled();
        });

        it('clones from the provided git URL', async () => {
            vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
                'https://example.com/repo.git',
            );

            await projectClone.remoteCloneCommandHandler();

            expect(cloneProjectFromSourceMock).toHaveBeenCalledWith(
                taskExecutor,
                {
                    type: 'git',
                    url: 'https://example.com/repo.git',
                },
            );
        });
    });

    describe('localCloneCommandHandler', () => {
        it('returns early when no folder is selected', async () => {
            getLocalSourcePathMock.mockResolvedValueOnce(undefined);

            await projectClone.localCloneCommandHandler();

            expect(cloneProjectFromSourceMock).not.toHaveBeenCalled();
        });

        it('clones from the selected local folder', async () => {
            getLocalSourcePathMock.mockResolvedValueOnce(localSourcePath);

            await projectClone.localCloneCommandHandler();

            expect(cloneProjectFromSourceMock).toHaveBeenCalledWith(
                taskExecutor,
                {
                    type: 'dir',
                    path: localSourcePath,
                },
            );
        });
    });

    describe('templateCloneCommandHandler', () => {
        it('returns early when no template is selected', async () => {
            getTemplateOfChoiceMock.mockResolvedValueOnce(undefined);

            await projectClone.templateCloneCommandHandler();

            expect(cloneProjectFromSourceMock).not.toHaveBeenCalled();
        });

        it('fetches templates for the selected target and clones the selected template', async () => {
            targetModel.setSelected('me@example.com');
            getTemplateOfChoiceMock.mockResolvedValueOnce(selectedTemplate);

            await projectClone.templateCloneCommandHandler();

            expect(getTemplateOfChoiceMock).toHaveBeenCalledWith(
                topoCli,
                'me@example.com',
            );
            expect(cloneProjectFromSourceMock).toHaveBeenCalledWith(
                taskExecutor,
                {
                    type: 'git',
                    url: selectedTemplate.url,
                },
            );
        });

        it('fetches templates without a target when none is selected', async () => {
            getTemplateOfChoiceMock.mockResolvedValueOnce(undefined);

            await projectClone.templateCloneCommandHandler();

            expect(getTemplateOfChoiceMock).toHaveBeenCalledWith(
                topoCli,
                undefined,
            );
        });
    });

    describe('clone error handling', () => {
        it('shows clone errors instead of throwing them', async () => {
            const error = new WrappedError('CLONE', 'task fail');
            vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
                'https://example.com/repo.git',
            );
            cloneProjectFromSourceMock.mockRejectedValueOnce(error);

            await projectClone.remoteCloneCommandHandler();

            expect(showAndLogError).toHaveBeenCalledWith(
                'Failed to clone project',
                error,
            );
        });

        it('shows CLI errors from template lookup instead of throwing them, preserving log entries', async () => {
            const logs = [{ level: 'Error' as const, msg: 'lscpu not found' }];
            const error = new WrappedError('CLI', 'boom', logs);
            getTemplateOfChoiceMock.mockRejectedValueOnce(error);

            await projectClone.templateCloneCommandHandler();

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
