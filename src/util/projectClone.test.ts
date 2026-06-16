import path from 'node:path';
import * as vscode from 'vscode';
import {
    cloneProjectFromSource,
    createCloneTask,
    getFirstSentence,
    getLocalSourcePath,
    getTemplateOfChoice,
} from './projectClone';
import { mutable } from './mutable';
import { TopoCli } from '../topoCli';
import { MockProxy, mock } from 'vitest-mock-extended';
import { TemplateDescription } from '../topoCliSchema';
import { WrappedError } from '../errors/wrappedError';
import { TaskExecutor } from './taskExecutor';

const showInformationMessageMock = vi.mocked(
    vscode.window.showInformationMessage as (
        message: string,
        options: vscode.MessageOptions,
        ...items: string[]
    ) => Thenable<string | undefined>,
);

const workspacePath = path.resolve('home', 'workspace');
const workspaceUri = vscode.Uri.file(workspacePath);
const workspaceFolders = [{ uri: workspaceUri, name: 'workspace', index: 0 }];
const destinationPath = path.resolve('home', 'destination');
const destinationUri = vscode.Uri.file(destinationPath);
const localTemplateUri = vscode.Uri.file(path.resolve('path', 'to', 'source'));

describe('project clone utilities', () => {
    const topoCli = mock<TopoCli>();
    let taskExecutor: MockProxy<TaskExecutor>;

    function expectCloneTask(
        task: vscode.Task,
        projectName: string,
        args: string[],
    ): void {
        expect(task.name).toBe(`Clone ${projectName}`);
        expect(task.execution).toMatchObject({
            process: 'topo',
            args,
            options: { cwd: undefined },
        });
    }

    beforeEach(() => {
        vi.resetAllMocks();
        taskExecutor = mock<TaskExecutor>();
        mutable(vscode.workspace).workspaceFolders = undefined;
    });

    describe('getFirstSentence', () => {
        it('returns the first sentence from text containing multiple sentences', () => {
            const got = getFirstSentence(
                'Template Apple description. Apple is a fruit.',
            );

            expect(got).toBe('Template Apple description.');
        });

        it('returns trimmed text when no sentence terminator exists', () => {
            const got = getFirstSentence('  Template Apple description  ');

            expect(got).toBe('Template Apple description');
        });
    });

    describe('getLocalSourcePath', () => {
        it('returns undefined when no folder is selected', async () => {
            vi.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce(
                undefined,
            );

            await expect(getLocalSourcePath()).resolves.toBeUndefined();
        });

        it('returns the selected folder path', async () => {
            vi.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce([
                localTemplateUri,
            ]);

            await expect(getLocalSourcePath()).resolves.toBe(
                localTemplateUri.fsPath,
            );
        });
    });

    describe('getTemplateOfChoice', () => {
        const templateList: TemplateDescription[] = [
            {
                name: 'template-alpha',
                url: 'https://example.com/templates/template-alpha.git',
                description: 'Template Apple description. Apple is a fruit.',
                ref: 'r',
                features: [],
            },
            {
                name: 'template-banana',
                url: 'https://example.com/templates/template-banana.git',
                description:
                    'Template Cabbage description. Cabbage is a vegetable.',
                ref: 'r',
                features: [],
            },
        ];

        const templateQuickPickItems = templateList.map((template) => ({
            label: template.name,
            detail: getFirstSentence(template.description),
            template,
        }));

        it('propagates errors from listTemplates', async () => {
            topoCli.listTemplates.mockImplementation(() => {
                throw new Error('command failed');
            });

            await expect(getTemplateOfChoice(topoCli)).rejects.toThrow(
                'command failed',
            );

            expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
        });

        it('returns undefined when no template is selected', async () => {
            topoCli.listTemplates.mockReturnValue(templateList);
            vi.mocked(vscode.window.showQuickPick).mockResolvedValueOnce(
                undefined,
            );

            await expect(getTemplateOfChoice(topoCli)).resolves.toBeUndefined();

            expect(taskExecutor.run).not.toHaveBeenCalled();
        });

        it('returns the selected template', async () => {
            topoCli.listTemplates.mockReturnValue(templateList);
            vi.mocked(vscode.window.showQuickPick).mockResolvedValueOnce(
                templateQuickPickItems[0],
            );

            await expect(
                getTemplateOfChoice(topoCli, 'me@example.com'),
            ).resolves.toEqual(templateList[0]);

            expect(topoCli.listTemplates).toHaveBeenCalledWith(
                'me@example.com',
            );
            expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
                templateQuickPickItems,
                {
                    placeHolder: 'Select a template to clone',
                },
            );
        });

        it('lists templates without a target when none is selected', async () => {
            topoCli.listTemplates.mockReturnValue(templateList);
            vi.mocked(vscode.window.showQuickPick).mockResolvedValueOnce(
                undefined,
            );

            await getTemplateOfChoice(topoCli, undefined);

            expect(topoCli.listTemplates).toHaveBeenCalledWith(undefined);
            expect(taskExecutor.run).not.toHaveBeenCalled();
        });
    });

    describe('createCloneTask', () => {
        it('builds a clone task with the topo command name', () => {
            const repositoryPath = path.resolve('workspace', 'repo');
            const task = createCloneTask(
                'repo',
                {
                    type: 'git',
                    url: 'https://example.com/repo.git',
                },
                repositoryPath,
                {
                    model: 'some-huggingface-id',
                },
            );

            expectCloneTask(task, 'repo', [
                'clone',
                'git:https://example.com/repo.git',
                repositoryPath,
                'model=some-huggingface-id',
            ]);
        });
    });

    describe('cloneProjectFromSource', () => {
        it('throws a clone error when an invalid clone URL is provided', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;

            await expect(
                cloneProjectFromSource(taskExecutor, {
                    type: 'git',
                    url: 'not-a-valid-url',
                }),
            ).rejects.toEqual(
                expect.objectContaining({
                    code: 'CLONE',
                    message: 'Invalid URL: not-a-valid-url',
                }),
            );

            expect(taskExecutor.run).not.toHaveBeenCalled();
        });

        it('returns false when no project name is provided', async () => {
            vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
                undefined,
            );

            await expect(
                cloneProjectFromSource(taskExecutor, {
                    type: 'git',
                    url: 'https://example.com/repo.git',
                }),
            ).resolves.toBe(false);

            expect(vscode.window.showOpenDialog).not.toHaveBeenCalled();
            expect(taskExecutor.run).not.toHaveBeenCalled();
        });

        it('returns false when destination folder selection is cancelled', async () => {
            vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce('repo');

            await expect(
                cloneProjectFromSource(taskExecutor, {
                    type: 'git',
                    url: 'https://example.com/repo.git',
                }),
            ).resolves.toBe(false);

            expect(taskExecutor.run).not.toHaveBeenCalled();
            expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
        });

        it('creates a clone task for a valid https git URL', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce('repo');

            await expect(
                cloneProjectFromSource(taskExecutor, {
                    type: 'git',
                    url: 'https://example.com/repo.git',
                }),
            ).resolves.toBe(true);

            expect(vscode.window.showInputBox).toHaveBeenCalledWith({
                prompt: 'Enter the project name',
                value: 'repo',
            });
            expect(taskExecutor.run).toHaveBeenCalledTimes(1);
            expectCloneTask(taskExecutor.run.mock.calls[0][0], 'repo', [
                'clone',
                'git:https://example.com/repo.git',
                path.join(workspaceUri.fsPath, 'repo'),
            ]);
        });

        it('creates a clone task for a valid SSH git URL', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce('repo');

            await cloneProjectFromSource(taskExecutor, {
                type: 'git',
                url: 'git@example.com:repo.git',
            });

            expect(vscode.window.showInputBox).toHaveBeenCalledWith({
                prompt: 'Enter the project name',
                value: 'repo',
            });
            expect(taskExecutor.run).toHaveBeenCalledTimes(1);
            expectCloneTask(taskExecutor.run.mock.calls[0][0], 'repo', [
                'clone',
                'git:git@example.com:repo.git',
                path.join(workspaceUri.fsPath, 'repo'),
            ]);
        });

        it('passes raw clone sources and arbitrary clone options through to topo clone', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce('repo');

            await cloneProjectFromSource(
                taskExecutor,
                {
                    value: 'https://example.com/repo.git',
                },
                {
                    model: 'some-huggingface-id',
                },
            );

            expect(taskExecutor.run).toHaveBeenCalledTimes(1);
            expectCloneTask(taskExecutor.run.mock.calls[0][0], 'repo', [
                'clone',
                'https://example.com/repo.git',
                path.join(workspaceUri.fsPath, 'repo'),
                'model=some-huggingface-id',
            ]);
        });

        it('creates a clone task for a local path', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
                'myproj',
            );

            await cloneProjectFromSource(taskExecutor, {
                type: 'dir',
                path: localTemplateUri.fsPath,
            });

            expect(vscode.window.showInputBox).toHaveBeenCalledWith({
                prompt: 'Enter the project name',
                value: 'source',
            });
            expect(taskExecutor.run).toHaveBeenCalledTimes(1);
            expectCloneTask(taskExecutor.run.mock.calls[0][0], 'myproj', [
                'clone',
                `dir:${localTemplateUri.fsPath}`,
                path.join(workspaceUri.fsPath, 'myproj'),
            ]);
        });

        it('uses the selected destination folder when no workspace is open', async () => {
            vi.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce([
                destinationUri,
            ]);
            vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce('repo');

            await cloneProjectFromSource(taskExecutor, {
                type: 'git',
                url: 'https://example.com/repo.git',
            });

            expect(vscode.window.showOpenDialog).toHaveBeenCalledWith({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: 'Select Destination Folder',
            });
            expect(taskExecutor.run).toHaveBeenCalledTimes(1);
            expectCloneTask(taskExecutor.run.mock.calls[0][0], 'repo', [
                'clone',
                'git:https://example.com/repo.git',
                path.join(destinationUri.fsPath, 'repo'),
            ]);
        });

        it('wraps errors thrown by the task executor', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce('repo');
            const err = new Error('task fail');
            taskExecutor.run.mockRejectedValueOnce(err);

            await expect(
                cloneProjectFromSource(taskExecutor, {
                    type: 'git',
                    url: 'https://example.com/repo.git',
                }),
            ).rejects.toEqual(
                expect.objectContaining({
                    code: 'CLONE',
                    message: err.message,
                }),
            );
        });

        it('prompts for a post-clone action after starting the clone task', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce('repo');

            await cloneProjectFromSource(taskExecutor, {
                type: 'git',
                url: 'https://example.com/repo.git',
            });

            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                'Would you like to open the cloned repository, or add it to the current workspace?',
                { modal: true },
                'Open',
                'Open in New Window',
                'Add to Workspace',
            );
        });

        it('opens the cloned repository in the current window when user selects Open', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce('repo');
            showInformationMessageMock.mockResolvedValueOnce('Open');

            await cloneProjectFromSource(taskExecutor, {
                type: 'git',
                url: 'https://example.com/repo.git',
            });

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'vscode.openFolder',
                vscode.Uri.file(path.join(workspaceUri.fsPath, 'repo')),
                { forceReuseWindow: true },
            );
        });

        it('opens the cloned repository in a new window when user selects Open in New Window', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce('repo');
            showInformationMessageMock.mockResolvedValueOnce(
                'Open in New Window',
            );

            await cloneProjectFromSource(taskExecutor, {
                type: 'git',
                url: 'https://example.com/repo.git',
            });

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'vscode.openFolder',
                vscode.Uri.file(path.join(workspaceUri.fsPath, 'repo')),
                { forceNewWindow: true },
            );
        });

        it('adds the cloned repository to the current workspace when user selects Add to Workspace', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce('repo');
            showInformationMessageMock.mockResolvedValueOnce(
                'Add to Workspace',
            );

            await cloneProjectFromSource(taskExecutor, {
                type: 'git',
                url: 'https://example.com/repo.git',
            });

            expect(
                vscode.workspace.updateWorkspaceFolders,
            ).toHaveBeenCalledWith(workspaceFolders.length, 0, {
                uri: vscode.Uri.file(path.join(workspaceUri.fsPath, 'repo')),
            });
        });

        it('does not prompt for a post-clone action when the clone task throws', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce('repo');
            const err = new Error('task fail');
            taskExecutor.run.mockRejectedValueOnce(err);

            await expect(
                cloneProjectFromSource(taskExecutor, {
                    type: 'git',
                    url: 'https://example.com/repo.git',
                }),
            ).rejects.toThrow(WrappedError);

            expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
        });
    });
});
