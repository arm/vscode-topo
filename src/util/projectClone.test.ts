import path from 'node:path';
import os from 'node:os';
import * as vscode from 'vscode';
import {
    cloneProjectFromSource,
    createCloneTask,
    getDefaultProjectNameFromUrl,
    getFirstSentence,
    getLocalSourcePath,
    promptForRemoteCloneSource,
} from './projectClone';
import { mutable } from './test/mutable';
import { TopoCli } from '../services/topoCli';
import { MockProxy, mock } from 'vitest-mock-extended';
import { TemplateDescription } from '../services/topoCliSchema';
import { WrappedError } from '../errors/wrappedError';
import { TaskExecutor } from './taskExecutor';
import { showAndLogError } from './showAndLog';

vi.mock('./showAndLog');

const showInformationMessageMock = vi.mocked(
    vscode.window.showInformationMessage as (
        message: string,
        options: vscode.MessageOptions,
        ...items: string[]
    ) => Thenable<string | undefined>,
);

function mockRemoteQuickPick<T extends vscode.QuickPickItem>() {
    const onDidAcceptEmitter = new vscode.EventEmitter<void>();
    const onDidHideEmitter = new vscode.EventEmitter<void>();
    const onDidChangeValueEmitter = new vscode.EventEmitter<string>();
    const quickPick = mock<vscode.QuickPick<T>>({
        busy: false,
        items: [],
        onDidAccept: onDidAcceptEmitter.event,
        onDidHide: onDidHideEmitter.event,
        onDidChangeValue: onDidChangeValueEmitter.event,
        selectedItems: [],
        value: '',
        hide: vi.fn(() => onDidHideEmitter.fire()),
    });
    vi.mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPick);

    return {
        quickPick,
        enterValue: (value: string) => {
            quickPick.value = value;
            onDidChangeValueEmitter.fire(value);
        },
        acceptItem: (index: number) => {
            quickPick.selectedItems = [quickPick.items[index]];
            onDidAcceptEmitter.fire();
        },
    };
}

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
        cwd?: string,
    ): void {
        expect(task.name).toBe(`Clone ${projectName}`);
        expect(task.execution).toMatchObject({
            process: 'topo',
            args,
            options: { cwd },
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

    describe('getDefaultProjectNameFromUrl', () => {
        it('returns the repository name for git URLs with commit refs', () => {
            expect(
                getDefaultProjectNameFromUrl(
                    'https://example.com/repo.git#8303e66db59a7a11e64877121f3db1b688d2011f',
                ),
            ).toBe('repo');
        });

        it('returns the repository name for scp-like SSH URLs with refs', () => {
            expect(
                getDefaultProjectNameFromUrl(
                    'git@example.com:owner/repo.git#main',
                ),
            ).toBe('repo');
        });
    });

    describe('promptForRemoteCloneSource', () => {
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
            label: `$(repo) ${template.name}`,
            detail: getFirstSentence(template.description),
            url: template.url,
        }));

        it('allows a custom URL when listing templates fails', async () => {
            const error = new Error('command failed');
            const url = 'https://example.com/repo.git';
            topoCli.listTemplates.mockRejectedValueOnce(error);
            const { enterValue, acceptItem } = mockRemoteQuickPick();

            const sourcePromise = promptForRemoteCloneSource(topoCli);
            enterValue(`  ${url}  `);
            acceptItem(0);

            await expect(sourcePromise).resolves.toEqual({
                type: 'git',
                url,
            });
            expect(showAndLogError).toHaveBeenCalledWith(
                'Failed to list templates',
                error,
            );
        });

        it('falls back to unfiltered templates when target-specific lookup fails', async () => {
            topoCli.listTemplates.mockImplementation(async (sshTarget) => {
                if (sshTarget) {
                    throw new WrappedError('CLI', 'target unhealthy');
                }
                return templateList;
            });
            const { quickPick } = mockRemoteQuickPick();

            const sourcePromise = promptForRemoteCloneSource(
                topoCli,
                'unhealthy-target',
            );
            quickPick.hide();

            await expect(sourcePromise).resolves.toBeUndefined();
            expect(topoCli.listTemplates).toHaveBeenNthCalledWith(
                1,
                'unhealthy-target',
            );
            expect(topoCli.listTemplates).toHaveBeenNthCalledWith(2);
        });

        it('returns the selected catalog template as a git source', async () => {
            topoCli.listTemplates.mockResolvedValue(templateList);
            const { quickPick, acceptItem } = mockRemoteQuickPick();

            const sourcePromise = promptForRemoteCloneSource(
                topoCli,
                'me@example.com',
            );
            await vi.waitFor(() =>
                expect(quickPick.items).toEqual(templateQuickPickItems),
            );
            acceptItem(1);

            await expect(sourcePromise).resolves.toEqual({
                type: 'git',
                url: templateList[1].url,
            });
            expect(topoCli.listTemplates).toHaveBeenCalledWith(
                'me@example.com',
            );
        });

        it('offers a typed git URL before the catalog templates', async () => {
            const url = 'https://example.com/repo.git';
            topoCli.listTemplates.mockResolvedValue(templateList);
            const { quickPick, enterValue, acceptItem } = mockRemoteQuickPick();

            const sourcePromise = promptForRemoteCloneSource(topoCli);
            enterValue(`  ${url}  `);
            await vi.waitFor(() => expect(quickPick.busy).toBe(false));
            acceptItem(0);

            await expect(sourcePromise).resolves.toEqual({
                type: 'git',
                url,
            });
            expect(quickPick.items).toEqual([
                {
                    label: `$(cloud-download) Custom URL`,
                    description: url,
                    url,
                },
                ...templateQuickPickItems,
            ]);
        });

        it('returns undefined and disposes the quick pick when dismissed', async () => {
            topoCli.listTemplates.mockResolvedValue(templateList);
            const { quickPick } = mockRemoteQuickPick();

            const sourcePromise = promptForRemoteCloneSource(topoCli);
            quickPick.hide();

            await expect(sourcePromise).resolves.toBeUndefined();
            expect(topoCli.listTemplates).toHaveBeenCalledWith();
            expect(quickPick.dispose).toHaveBeenCalledOnce();
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

            expectCloneTask(
                task,
                'repo',
                [
                    'clone',
                    'git:https://example.com/repo.git',
                    repositoryPath,
                    'model=some-huggingface-id',
                ],
                os.homedir(),
            );
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
            expectCloneTask(
                taskExecutor.run.mock.calls[0][0],
                'repo',
                [
                    'clone',
                    'git:https://example.com/repo.git',
                    path.join(destinationUri.fsPath, 'repo'),
                ],
                os.homedir(),
            );
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
