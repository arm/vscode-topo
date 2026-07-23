import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import * as vscode from 'vscode';
import {
    cloneProject,
    createCloneTask,
    getDefaultProjectNameFromUrl,
    getFirstSentence,
    getLocalSourcePath,
    promptForRemoteCloneSource,
} from './projectClone';
import { mutable } from './test/mutable';
import { TopoCli } from '../services/topoCli';
import { MockProxy, mock } from 'vitest-mock-extended';
import { ProjectDescription } from '../services/topoCliSchema';
import { WrappedError } from '../errors/wrappedError';
import { TaskExecutor } from './taskExecutor';
import { showAndLogError } from './showAndLog';

vi.mock('./showAndLog');

const showInformationMessageForStrings: (
    message: string,
    options: vscode.MessageOptions,
    ...items: string[]
) => Thenable<string | undefined> = vscode.window.showInformationMessage;
const showInformationMessageMock = vi.mocked(showInformationMessageForStrings);

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

const workspaceUri = vscode.Uri.file(path.resolve('home', 'workspace'));
const workspaceFolders = [{ uri: workspaceUri, name: 'workspace', index: 0 }];
const destinationUri = vscode.Uri.file(path.resolve('home', 'destination'));
const localProjectUri = vscode.Uri.file(path.resolve('path', 'to', 'source'));

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
        vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    });

    afterEach(() => vi.restoreAllMocks());

    describe('getFirstSentence', () => {
        it('returns the first sentence from text containing multiple sentences', () => {
            const got = getFirstSentence(
                'Project Apple description. Apple is a fruit.',
            );

            expect(got).toBe('Project Apple description.');
        });

        it('returns trimmed text when no sentence terminator exists', () => {
            const got = getFirstSentence('  Project Apple description  ');

            expect(got).toBe('Project Apple description');
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
                localProjectUri,
            ]);

            await expect(getLocalSourcePath()).resolves.toBe(
                localProjectUri.fsPath,
            );
        });
    });

    describe('getDefaultProjectNameFromUrl', () => {
        it('returns the repository name for git URLs with commit refs', () => {
            expect(
                getDefaultProjectNameFromUrl(
                    'https://example.com/virtual-bittermelon-peeler.git#8303e66db59a7a11e64877121f3db1b688d2011f',
                ),
            ).toBe('virtual-bittermelon-peeler');
        });

        it('returns the repository name for scp-like SSH URLs with refs', () => {
            expect(
                getDefaultProjectNameFromUrl(
                    'git@example.com:owner/virtual-bittermelon-peeler.git#main',
                ),
            ).toBe('virtual-bittermelon-peeler');
        });
    });

    describe('promptForRemoteCloneSource', () => {
        const projectList: ProjectDescription[] = [
            {
                name: 'project-alpha',
                url: 'https://example.com/projects/project-alpha.git',
                description: 'Project Apple description. Apple is a fruit.',
                ref: 'r',
                features: [],
            },
            {
                name: 'project-banana',
                url: 'https://example.com/projects/project-banana.git',
                description:
                    'Project Cabbage description. Cabbage is a vegetable.',
                ref: 'r',
                features: [],
            },
        ];

        const projectQuickPickItems = projectList.map((project) => ({
            label: `$(repo) ${project.name}`,
            detail: getFirstSentence(project.description),
            url: project.url,
        }));

        it('allows a custom URL when listing projects fails', async () => {
            const error = new Error('command failed');
            const url = 'https://example.com/virtual-bittermelon-peeler.git';
            topoCli.listProjects.mockRejectedValueOnce(error);
            const { enterValue, acceptItem } = mockRemoteQuickPick();

            const sourcePromise = promptForRemoteCloneSource(topoCli);
            enterValue(`  ${url}  `);
            acceptItem(0);

            await expect(sourcePromise).resolves.toEqual({
                type: 'git',
                url,
            });
            expect(showAndLogError).toHaveBeenCalledWith(
                'Failed to list projects',
                error,
            );
        });

        it('falls back to unfiltered projects when target-specific lookup fails', async () => {
            topoCli.listProjects.mockImplementation(async (sshTarget) => {
                if (sshTarget) {
                    throw new WrappedError('CLI', 'target unhealthy');
                }
                return projectList;
            });
            const { quickPick } = mockRemoteQuickPick();

            const sourcePromise = promptForRemoteCloneSource(
                topoCli,
                'unhealthy-target',
            );
            quickPick.hide();

            await expect(sourcePromise).resolves.toBeUndefined();
            expect(topoCli.listProjects).toHaveBeenNthCalledWith(
                1,
                'unhealthy-target',
            );
            expect(topoCli.listProjects).toHaveBeenNthCalledWith(2);
        });

        it('returns the selected catalog project as a git source', async () => {
            topoCli.listProjects.mockResolvedValue(projectList);
            const { quickPick, acceptItem } = mockRemoteQuickPick();

            const sourcePromise = promptForRemoteCloneSource(
                topoCli,
                'me@example.com',
            );
            await vi.waitFor(() =>
                expect(quickPick.items).toEqual(projectQuickPickItems),
            );
            acceptItem(1);

            await expect(sourcePromise).resolves.toEqual({
                type: 'git',
                url: projectList[1].url,
            });
            expect(topoCli.listProjects).toHaveBeenCalledWith('me@example.com');
        });

        it('offers a typed git URL before the catalog projects', async () => {
            const url = 'https://example.com/virtual-bittermelon-peeler.git';
            topoCli.listProjects.mockResolvedValue(projectList);
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
                ...projectQuickPickItems,
            ]);
        });

        it('returns undefined and disposes the quick pick when dismissed', async () => {
            topoCli.listProjects.mockResolvedValue(projectList);
            const { quickPick } = mockRemoteQuickPick();

            const sourcePromise = promptForRemoteCloneSource(topoCli);
            quickPick.hide();

            await expect(sourcePromise).resolves.toBeUndefined();
            expect(topoCli.listProjects).toHaveBeenCalledWith();
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
                    url: 'https://example.com/virtual-bittermelon-peeler.git',
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
                    'git:https://example.com/virtual-bittermelon-peeler.git',
                    repositoryPath,
                    'model=some-huggingface-id',
                ],
                os.homedir(),
            );
        });
    });

    describe('cloneProject', () => {
        beforeEach(() => {
            vi.mocked(vscode.window.showOpenDialog).mockResolvedValue([
                workspaceUri,
            ]);
        });

        it('throws a clone error when an invalid clone URL is provided', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;

            await expect(
                cloneProject(taskExecutor, {
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

        it('stops when no project name is provided for an existing default project path', async () => {
            vi.mocked(fs.existsSync).mockReturnValueOnce(true);
            vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
                undefined,
            );

            await cloneProject(taskExecutor, {
                type: 'git',
                url: 'https://example.com/virtual-bittermelon-peeler.git',
            });

            expect(vscode.window.showInputBox).toHaveBeenCalledWith({
                prompt: 'Enter the project name',
                value: 'virtual-bittermelon-peeler',
            });
            expect(taskExecutor.run).not.toHaveBeenCalled();
        });

        it('stops when no destination folder is selected', async () => {
            vi.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce(
                undefined,
            );

            await cloneProject(taskExecutor, {
                type: 'git',
                url: 'https://example.com/virtual-bittermelon-peeler.git',
            });

            expect(vscode.window.showInputBox).not.toHaveBeenCalled();
            expect(taskExecutor.run).not.toHaveBeenCalled();
        });

        it('creates a clone task for a valid https git URL', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;

            await cloneProject(taskExecutor, {
                type: 'git',
                url: 'https://example.com/virtual-bittermelon-peeler.git',
            });

            expect(fs.existsSync).toHaveBeenCalledWith(
                path.join(workspaceUri.fsPath, 'virtual-bittermelon-peeler'),
            );
            expect(taskExecutor.run).toHaveBeenCalledTimes(1);
            expectCloneTask(
                taskExecutor.run.mock.calls[0][0],
                'virtual-bittermelon-peeler',
                [
                    'clone',
                    'git:https://example.com/virtual-bittermelon-peeler.git',
                    path.join(
                        workspaceUri.fsPath,
                        'virtual-bittermelon-peeler',
                    ),
                ],
            );
        });

        it('creates a clone task for a valid SSH git URL', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;

            await cloneProject(taskExecutor, {
                type: 'git',
                url: 'git@example.com:virtual-bittermelon-peeler.git',
            });

            expect(taskExecutor.run).toHaveBeenCalledTimes(1);
            expectCloneTask(
                taskExecutor.run.mock.calls[0][0],
                'virtual-bittermelon-peeler',
                [
                    'clone',
                    'git:git@example.com:virtual-bittermelon-peeler.git',
                    path.join(
                        workspaceUri.fsPath,
                        'virtual-bittermelon-peeler',
                    ),
                ],
            );
        });

        it('passes raw clone sources and arbitrary clone options through to topo clone', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;

            await cloneProject(
                taskExecutor,
                {
                    value: 'https://example.com/virtual-bittermelon-peeler.git',
                },
                {
                    model: 'some-huggingface-id',
                },
            );

            expect(taskExecutor.run).toHaveBeenCalledTimes(1);
            expectCloneTask(
                taskExecutor.run.mock.calls[0][0],
                'virtual-bittermelon-peeler',
                [
                    'clone',
                    'https://example.com/virtual-bittermelon-peeler.git',
                    path.join(
                        workspaceUri.fsPath,
                        'virtual-bittermelon-peeler',
                    ),
                    'model=some-huggingface-id',
                ],
            );
        });

        it('asks for a project name when the default path is already used', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            vi.mocked(fs.existsSync).mockReturnValueOnce(true);
            vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
                'myproj',
            );

            await cloneProject(taskExecutor, {
                type: 'dir',
                path: localProjectUri.fsPath,
            });

            expect(fs.existsSync).toHaveBeenCalledWith(
                path.join(workspaceUri.fsPath, 'source'),
            );
            expect(vscode.window.showInputBox).toHaveBeenCalledWith({
                prompt: 'Enter the project name',
                value: 'source',
            });
            expect(taskExecutor.run).toHaveBeenCalledTimes(1);
            expectCloneTask(taskExecutor.run.mock.calls[0][0], 'myproj', [
                'clone',
                `dir:${localProjectUri.fsPath}`,
                path.join(workspaceUri.fsPath, 'myproj'),
            ]);
        });

        it('uses the selected destination folder when no workspace is open', async () => {
            vi.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce([
                destinationUri,
            ]);

            await cloneProject(taskExecutor, {
                type: 'git',
                url: 'https://example.com/virtual-bittermelon-peeler.git',
            });

            expect(taskExecutor.run).toHaveBeenCalledTimes(1);
            expectCloneTask(
                taskExecutor.run.mock.calls[0][0],
                'virtual-bittermelon-peeler',
                [
                    'clone',
                    'git:https://example.com/virtual-bittermelon-peeler.git',
                    path.join(
                        destinationUri.fsPath,
                        'virtual-bittermelon-peeler',
                    ),
                ],
                os.homedir(),
            );
        });

        it('wraps errors thrown by the task executor', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            const err = new Error('task fail');
            taskExecutor.run.mockRejectedValueOnce(err);

            await expect(
                cloneProject(taskExecutor, {
                    type: 'git',
                    url: 'https://example.com/virtual-bittermelon-peeler.git',
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

            await cloneProject(taskExecutor, {
                type: 'git',
                url: 'https://example.com/virtual-bittermelon-peeler.git',
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
            showInformationMessageMock.mockResolvedValueOnce('Open');

            await cloneProject(taskExecutor, {
                type: 'git',
                url: 'https://example.com/virtual-bittermelon-peeler.git',
            });

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'vscode.openFolder',
                vscode.Uri.file(
                    path.join(
                        workspaceUri.fsPath,
                        'virtual-bittermelon-peeler',
                    ),
                ),
                { forceReuseWindow: true },
            );
        });

        it('opens the cloned repository in a new window when user selects Open in New Window', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            showInformationMessageMock.mockResolvedValueOnce(
                'Open in New Window',
            );

            await cloneProject(taskExecutor, {
                type: 'git',
                url: 'https://example.com/virtual-bittermelon-peeler.git',
            });

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'vscode.openFolder',
                vscode.Uri.file(
                    path.join(
                        workspaceUri.fsPath,
                        'virtual-bittermelon-peeler',
                    ),
                ),
                { forceNewWindow: true },
            );
        });

        it('adds the cloned repository to the current workspace when user selects Add to Workspace', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            showInformationMessageMock.mockResolvedValueOnce(
                'Add to Workspace',
            );

            await cloneProject(taskExecutor, {
                type: 'git',
                url: 'https://example.com/virtual-bittermelon-peeler.git',
            });

            expect(
                vscode.workspace.updateWorkspaceFolders,
            ).toHaveBeenCalledWith(workspaceFolders.length, 0, {
                uri: vscode.Uri.file(
                    path.join(
                        workspaceUri.fsPath,
                        'virtual-bittermelon-peeler',
                    ),
                ),
            });
        });

        it('does not prompt for a post-clone action when the clone task throws', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            const err = new Error('task fail');
            taskExecutor.run.mockRejectedValueOnce(err);

            await expect(
                cloneProject(taskExecutor, {
                    type: 'git',
                    url: 'https://example.com/virtual-bittermelon-peeler.git',
                }),
            ).rejects.toThrow(WrappedError);

            expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
        });
    });
});
