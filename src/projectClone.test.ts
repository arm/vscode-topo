import path from 'node:path';
import * as vscode from 'vscode';
import { getFirstSentence, ProjectClone } from './projectClone';
import { mutable } from './util/mutable';
import { TopoCli } from './topoCli';
import { mock, MockProxy } from 'jest-mock-extended';
import { TemplateDescription } from './topoCliSchema';
import { showAndLogError } from './util/showAndLogError';
import { TargetStore } from './target/targetStore';
import { WrappedError } from './errors/wrappedError';
import { executeTask } from './util/executeTask';

jest.mock('./util/showAndLogError', () => ({
    showAndLogError: jest.fn(),
}));
jest.mock('./util/executeTask');

const executeTaskMock = jest.mocked(executeTask);

const executeCommand = async function (command: string, ...args: unknown[]) {
    const registeredCommands = jest.mocked(vscode.commands.registerCommand).mock
        .calls;
    const handler = registeredCommands.find(
        (c: unknown[]) => c[0] === command,
    )?.[1];
    await handler!(...args);
};

const subscriptions: vscode.Disposable[] = [];

const workspacePath = path.join('home', 'workspace');
const workspaceUri = vscode.Uri.file(workspacePath);
const workspaceFolders = [{ uri: workspaceUri, name: 'workspace', index: 0 }];
type ShowInformationMessageWithStrings = (
    message: string,
    options: vscode.MessageOptions,
    ...items: string[]
) => Thenable<string | undefined>;

describe('ProjectClone', () => {
    let projectClone: ProjectClone;
    const topoCli = mock<TopoCli>();
    const targetStore = mock<TargetStore>();
    let context: MockProxy<vscode.ExtensionContext>;
    const localTemplateUri = vscode.Uri.file('/path/to/source');
    const showInformationMessageMock: jest.MockedFunction<ShowInformationMessageWithStrings> =
        jest.fn();

    beforeEach(async () => {
        jest.resetAllMocks();
        subscriptions.length = 0;
        mutable(vscode.workspace).workspaceFolders = undefined;
        mutable(vscode.window).showInformationMessage =
            showInformationMessageMock;
        context = mock<vscode.ExtensionContext>({
            subscriptions: subscriptions,
        });
        projectClone = new ProjectClone(context, topoCli, targetStore);
        await projectClone.activate();
    });

    it('registers the command on activate', async () => {
        expect(jest.mocked(vscode.commands.registerCommand)).toHaveBeenCalled();
        expect(subscriptions.length).toBeGreaterThan(0);
    });

    describe('cloneRemoteProject', () => {
        it('return early when no clone url provided', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
                undefined,
            );

            await executeCommand(ProjectClone.remoteCloneCommand);

            expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
            expect(executeTaskMock).not.toHaveBeenCalled();
        });

        it('shows error when invalid clone url provided', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            jest.mocked(vscode.window.showInputBox)
                .mockResolvedValueOnce('not-a-valid-url')
                .mockResolvedValueOnce('repo');

            await executeCommand(ProjectClone.remoteCloneCommand);

            expect(showAndLogError).toHaveBeenCalledWith(
                'Failed to clone project',
                expect.objectContaining({
                    code: 'CLONE',
                    message: 'Invalid URL: not-a-valid-url',
                }),
            );

            expect(executeTaskMock).not.toHaveBeenCalled();
        });

        it('returns early when no project name provided', async () => {
            mutable(vscode.workspace).workspaceFolders = [];
            jest.mocked(vscode.window.showInputBox)
                .mockResolvedValueOnce('https://example.com/repo.git')
                .mockResolvedValueOnce(undefined);

            await executeCommand(ProjectClone.remoteCloneCommand);

            expect(vscode.window.showOpenDialog).not.toHaveBeenCalled();
            expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
            expect(executeTaskMock).not.toHaveBeenCalled();
        });

        it('returns early when destination folder selection is cancelled', async () => {
            mutable(vscode.workspace).workspaceFolders = [];
            jest.mocked(vscode.window.showInputBox)
                .mockResolvedValueOnce('https://example.com/repo.git')
                .mockResolvedValueOnce('repo');

            await executeCommand(ProjectClone.remoteCloneCommand);

            expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
            expect(executeTaskMock).not.toHaveBeenCalled();
            expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
        });

        it('creates task and runs clone command on valid https git URL', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            jest.mocked(vscode.window.showInputBox)
                .mockResolvedValueOnce('https://example.com/repo.git')
                .mockResolvedValueOnce('repo');
            showInformationMessageMock.mockResolvedValueOnce(undefined);

            await executeCommand(ProjectClone.remoteCloneCommand);

            expect(executeTaskMock).toHaveBeenCalledWith('Clone repo', [
                'topo',
                'clone',
                'git:https://example.com/repo.git',
                path.join(workspaceUri.fsPath, 'repo'),
            ]);
        });

        it('creates task and runs clone command on valid SSH git URL', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            jest.mocked(vscode.window.showInputBox)
                .mockResolvedValueOnce('git@example.com:repo.git')
                .mockResolvedValueOnce('repo');
            showInformationMessageMock.mockResolvedValueOnce(undefined);

            await executeCommand(ProjectClone.remoteCloneCommand);

            expect(executeTaskMock).toHaveBeenCalledWith('Clone repo', [
                'topo',
                'clone',
                'git:git@example.com:repo.git',
                path.join(workspaceUri.fsPath, 'repo'),
            ]);
        });

        it('passes arbitrary clone options through to topo clone', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
                'repo',
            );

            await projectClone.cloneProjectFromSource(
                {
                    value: 'https://example.com/repo.git',
                },
                {
                    cloneBuildArgs: {
                        model: 'some-huggingface-id',
                    },
                },
            );

            expect(executeTaskMock).toHaveBeenCalledWith('Clone repo', [
                'topo',
                'clone',
                'https://example.com/repo.git',
                path.join(workspaceUri.fsPath, 'repo'),
                'model=some-huggingface-id',
            ]);
        });

        it('uses a programmatic project name without prompting when it does not exist', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            jest.mocked(vscode.workspace.fs.stat).mockRejectedValueOnce(
                new Error('not found'),
            );

            await projectClone.cloneProjectFromSource(
                {
                    type: 'git',
                    url: 'https://example.com/repo.git',
                },
                { projectName: 'generated-project' },
            );

            expect(vscode.window.showInputBox).not.toHaveBeenCalled();
            expect(executeTaskMock).toHaveBeenCalledWith(
                'Clone generated-project',
                [
                    'topo',
                    'clone',
                    'git:https://example.com/repo.git',
                    path.join(workspaceUri.fsPath, 'generated-project'),
                ],
            );
        });

        it('uses a project name passed to the remote clone command', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            jest.mocked(vscode.workspace.fs.stat).mockRejectedValueOnce(
                new Error('not found'),
            );
            jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
                'https://example.com/repo.git',
            );

            await executeCommand(ProjectClone.remoteCloneCommand, {
                projectName: 'command-project',
            });

            expect(vscode.window.showInputBox).toHaveBeenCalledTimes(1);
            expect(vscode.window.showInputBox).toHaveBeenCalledWith({
                prompt: 'Enter the git URL to clone from',
            });
            expect(executeTaskMock).toHaveBeenCalledWith(
                'Clone command-project',
                [
                    'topo',
                    'clone',
                    'git:https://example.com/repo.git',
                    path.join(workspaceUri.fsPath, 'command-project'),
                ],
            );
        });

        it('prompts for a project name when a programmatic project name already exists', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            jest.mocked(vscode.workspace.fs.stat).mockResolvedValueOnce(
                {} as vscode.FileStat,
            );
            jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
                'manual-project',
            );

            await projectClone.cloneProjectFromSource(
                {
                    type: 'git',
                    url: 'https://example.com/repo.git',
                },
                { projectName: 'existing-project' },
            );

            expect(vscode.window.showInputBox).toHaveBeenCalledWith({
                prompt: 'Enter the project name',
                value: 'repo',
            });
            expect(executeTaskMock).toHaveBeenCalledWith(
                'Clone manual-project',
                [
                    'topo',
                    'clone',
                    'git:https://example.com/repo.git',
                    path.join(workspaceUri.fsPath, 'manual-project'),
                ],
            );
        });

        it('shows an error when executeTask throws', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            jest.mocked(vscode.window.showInputBox)
                .mockResolvedValueOnce('https://example.com/repo.git')
                .mockResolvedValueOnce('repo');
            const err = new Error('task fail');
            executeTaskMock.mockRejectedValueOnce(err);

            await executeCommand(ProjectClone.remoteCloneCommand);

            expect(showAndLogError).toHaveBeenCalledWith(
                'Failed to clone project',
                expect.objectContaining({
                    code: 'CLONE',
                    message: err.message,
                }),
            );
        });
    });

    describe('cloneLocalProject', () => {
        it('returns early when no folder selected', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            jest.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce(
                undefined,
            );

            await executeCommand(ProjectClone.localCloneCommand);

            expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
            expect(executeTaskMock).not.toHaveBeenCalled();
        });

        it('returns early when no project name provided', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            jest.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce([
                localTemplateUri,
            ]);
            jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
                undefined,
            );

            await executeCommand(ProjectClone.localCloneCommand);

            expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
            expect(executeTaskMock).not.toHaveBeenCalled();
        });

        it('creates task and runs clone command for local path', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            jest.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce([
                localTemplateUri,
            ]);
            jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
                'myproj',
            );
            showInformationMessageMock.mockResolvedValueOnce(undefined);

            await executeCommand(ProjectClone.localCloneCommand);

            expect(executeTaskMock).toHaveBeenCalledWith('Clone myproj', [
                'topo',
                'clone',
                `dir:${localTemplateUri.fsPath}`,
                path.join(workspaceUri.fsPath, 'myproj'),
            ]);
        });
    });

    describe('cloneTemplateProject', () => {
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

        const showQuickPickItemMock = jest.mocked(vscode.window.showQuickPick);

        it('propagates generic from listTemplates', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            topoCli.listTemplates.mockImplementation(() => {
                throw new Error('command failed');
            });

            await expect(
                executeCommand(ProjectClone.templateCloneCommand),
            ).rejects.toThrow('command failed');

            expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
            expect(executeTaskMock).not.toHaveBeenCalled();
        });

        it('shows structured error detail when listTemplates throws WrappedError', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            const logEntries = [
                {
                    level: 'Error',
                    msg: 'lscpu not found',
                },
                {
                    level: 'Info',
                    msg: 'some info',
                },
                {
                    level: 'Error',
                    msg: 'connection lost',
                },
            ] as const;
            topoCli.listTemplates.mockImplementation(() => {
                throw new WrappedError(
                    'CLI',
                    'lscpu not found; connection lost',
                    [...logEntries],
                );
            });

            await executeCommand(ProjectClone.templateCloneCommand);

            expect(showAndLogError).toHaveBeenCalledWith(
                'Failed to clone project',
                expect.any(WrappedError),
            );
            expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
            expect(executeTaskMock).not.toHaveBeenCalled();
        });

        it('returns early when no template selected', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            topoCli.listTemplates.mockReturnValue(templateList);
            jest.mocked(vscode.window.showQuickPick).mockResolvedValueOnce(
                undefined,
            );

            await executeCommand(ProjectClone.templateCloneCommand);

            expect(executeTaskMock).not.toHaveBeenCalled();
        });

        it('returns early when no project name provided', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            topoCli.listTemplates.mockReturnValue(templateList);
            showQuickPickItemMock.mockResolvedValueOnce(
                templateQuickPickItems[0],
            );
            jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
                undefined,
            );

            await executeCommand(ProjectClone.templateCloneCommand);

            expect(executeTaskMock).not.toHaveBeenCalled();
        });

        it('creates task and runs clone command for template selection', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            targetStore.getSelectedTarget.mockResolvedValue('me@example.com');
            topoCli.listTemplates.mockReturnValue(templateList);
            showQuickPickItemMock.mockResolvedValueOnce(
                templateQuickPickItems[0],
            );
            jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
                'myproj',
            );
            showInformationMessageMock.mockResolvedValueOnce(undefined);

            await executeCommand(ProjectClone.templateCloneCommand);

            expect(topoCli.listTemplates).toHaveBeenCalledWith(
                'me@example.com',
            );

            expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
                templateQuickPickItems,
                {
                    placeHolder: 'Select a template to clone',
                },
            );
            expect(vscode.window.showInputBox).toHaveBeenCalledWith({
                prompt: 'Enter the project name',
                value: 'template-alpha',
            });
            expect(executeTaskMock).toHaveBeenCalledWith('Clone myproj', [
                'topo',
                'clone',
                'git:https://example.com/templates/template-alpha.git',
                path.join(workspaceUri.fsPath, 'myproj'),
            ]);
        });

        it('lists templates without a target when none is selected', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            targetStore.getSelectedTarget.mockResolvedValue(undefined);
            topoCli.listTemplates.mockReturnValue(templateList);
            jest.mocked(vscode.window.showQuickPick).mockResolvedValueOnce(
                undefined,
            );

            await executeCommand(ProjectClone.templateCloneCommand);

            expect(topoCli.listTemplates).toHaveBeenCalledWith(undefined);
            expect(showAndLogError).not.toHaveBeenCalled();
            expect(executeTaskMock).not.toHaveBeenCalled();
        });
    });

    describe('postCloneAction', () => {
        it('prompts for a post-clone action after starting the clone task', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
                'repo',
            );
            showInformationMessageMock.mockResolvedValueOnce(undefined);

            await projectClone.cloneProjectFromSource({
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
            jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
                'repo',
            );
            showInformationMessageMock.mockResolvedValueOnce('Open');
            await projectClone.cloneProjectFromSource({
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
            jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
                'repo',
            );
            showInformationMessageMock.mockResolvedValueOnce(
                'Open in New Window',
            );
            await projectClone.cloneProjectFromSource({
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
            jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
                'repo',
            );
            showInformationMessageMock.mockResolvedValueOnce(
                'Add to Workspace',
            );

            await projectClone.cloneProjectFromSource({
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
            jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
                'repo',
            );
            const err = new Error('task fail');
            executeTaskMock.mockRejectedValueOnce(err);

            await expect(
                projectClone.cloneProjectFromSource({
                    type: 'git',
                    url: 'https://example.com/repo.git',
                }),
            ).rejects.toThrow(err.message);

            expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
        });

        it('does not prompt for a post-clone action when disabled in clone options', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
                'repo',
            );

            await projectClone.cloneProjectFromSource(
                {
                    type: 'git',
                    url: 'https://example.com/repo.git',
                },
                {
                    runPostCloneAction: false,
                },
            );

            expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
        });
    });
});
