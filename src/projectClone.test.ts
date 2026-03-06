import path from 'path';
import * as vscode from 'vscode';
import * as manifest from './manifest';
import { ProjectClone } from './projectClone';
import { mutable } from './util/mutable';
import { TopoCli } from './topoCli';
import { mock, MockProxy } from 'jest-mock-extended';
import { TemplateDescription } from './topoCliSchema';

const waitImmediate = () =>
    new Promise<void>((resolve) => setTimeout(() => resolve(), 0));

const getFirstSentence = (text?: string): string | undefined => {
    if (!text) {
        return undefined;
    }
    const trimmed = text.trim();
    if (!trimmed) {
        return undefined;
    }
    const match = trimmed.match(/^.*?[.!?](?=\s|$)/);
    return (match ? match[0] : trimmed).trim();
};

const executeCommand = async function (command: string, ...args: unknown[]) {
    const registeredCommands = jest.mocked(vscode.commands.registerCommand).mock
        .calls;
    const rawHandler = registeredCommands.find(
        (c: unknown[]) => c[0] === command,
    );
    const handler = rawHandler![1] as (...args: unknown[]) => Promise<void>;
    await handler(...args);
    await waitImmediate();
};

const subscriptions: vscode.Disposable[] = [];

const workspacePath = path.join('home', 'workspace');
const workspaceUri = vscode.Uri.file(workspacePath);
const workspaceFolders = [{ uri: workspaceUri, name: 'workspace', index: 0 }];

describe('ProjectClone', () => {
    let projectClone: ProjectClone;
    const topoCli = mock<TopoCli>();
    let context: MockProxy<vscode.ExtensionContext>;
    const taskExec: vscode.TaskExecution = {
        task: {
            definition: { type: 'shell', taskId: 'topo clone' },
            scope: undefined,
            name: '',
            isBackground: false,
            source: '',
            presentationOptions: {},
            problemMatchers: [],
            runOptions: {},
        },
        terminate: jest.fn(),
    };
    const localTemplateUri = vscode.Uri.file('/path/to/source');

    beforeEach(async () => {
        jest.resetAllMocks();
        mutable(vscode.workspace).workspaceFolders = undefined;
        context = mock<vscode.ExtensionContext>({
            subscriptions: subscriptions,
        });
        projectClone = new ProjectClone(context, topoCli);
        await projectClone.activate();
    });

    it('registers the command on activate', async () => {
        expect(jest.mocked(vscode.commands.registerCommand)).toHaveBeenCalled();
        expect(subscriptions.length).toBeGreaterThan(0);
    });

    describe('cloneRemoteProject', () => {
        it('shows error when no workspace folder open', async () => {
            await executeCommand(ProjectClone.remoteCloneCommand);

            const errMsg =
                'No workspace folder is open. Please open a folder to clone the project into.';
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(errMsg);
        });

        it('return early when no clone url provided', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
                undefined,
            );

            await executeCommand(ProjectClone.remoteCloneCommand);

            expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
            expect(vscode.tasks.executeTask).not.toHaveBeenCalled();
        });

        it('shows error when invalid clone url provided', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            jest.mocked(vscode.window.showInputBox)
                .mockResolvedValueOnce('not-a-valid-url')
                .mockResolvedValueOnce('repo');

            await executeCommand(ProjectClone.remoteCloneCommand);

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('is not a valid URL'),
            );
        });

        it('returns early when no project name provided', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            jest.mocked(vscode.window.showInputBox)
                .mockResolvedValueOnce('https://example.com/repo.git')
                .mockResolvedValueOnce(undefined);

            await executeCommand(ProjectClone.remoteCloneCommand);

            expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
            expect(vscode.tasks.executeTask).not.toHaveBeenCalled();
        });

        it('creates task and runs clone command on valid https git URL', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            jest.mocked(vscode.workspace).getWorkspaceFolder.mockReturnValue(
                workspaceFolders[0],
            );
            jest.mocked(vscode.Task).mockReturnValue(taskExec.task);
            jest.mocked(vscode.window.showInputBox)
                .mockResolvedValueOnce('https://example.com/repo.git')
                .mockResolvedValueOnce('repo');

            await executeCommand(ProjectClone.remoteCloneCommand);

            expect(vscode.ShellExecution).toHaveBeenCalledWith(
                'topo',
                [
                    'clone',
                    path.join(workspaceUri.fsPath, 'repo'),
                    'git:https://example.com/repo.git',
                ],
                { cwd: workspaceUri.fsPath },
            );
            expect(vscode.Task).toHaveBeenCalledWith(
                { type: 'shell', taskId: `${manifest.PACKAGE_NAME} clone` },
                expect.anything(),
                `Clone repo`,
                manifest.DISPLAY_NAME,
                expect.any(vscode.ShellExecution),
            );
            expect(vscode.tasks.executeTask).toHaveBeenCalledWith(
                expect.objectContaining({
                    presentationOptions: expect.anything(),
                }),
            );
        });

        it('creates task and runs clone command on valid SSH git URL', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            jest.mocked(vscode.workspace).getWorkspaceFolder.mockReturnValue(
                workspaceFolders[0],
            );
            jest.mocked(vscode.Task).mockReturnValue(taskExec.task);
            jest.mocked(vscode.window.showInputBox)
                .mockResolvedValueOnce('git@example.com:repo.git')
                .mockResolvedValueOnce('repo');

            await executeCommand(ProjectClone.remoteCloneCommand);

            expect(vscode.ShellExecution).toHaveBeenCalledWith(
                'topo',
                [
                    'clone',
                    path.join(workspaceUri.fsPath, 'repo'),
                    'git:git@example.com:repo.git',
                ],
                { cwd: workspaceUri.fsPath },
            );
            expect(vscode.Task).toHaveBeenCalledWith(
                { type: 'shell', taskId: `${manifest.PACKAGE_NAME} clone` },
                expect.anything(),
                `Clone repo`,
                manifest.DISPLAY_NAME,
                expect.any(vscode.ShellExecution),
            );
            expect(vscode.tasks.executeTask).toHaveBeenCalledWith(
                expect.objectContaining({
                    presentationOptions: expect.anything(),
                }),
            );
        });

        it('shows error when executeTask throws', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            jest.mocked(vscode.workspace).getWorkspaceFolder.mockReturnValue(
                workspaceFolders[0],
            );
            jest.mocked(vscode.Task).mockReturnValue(taskExec.task);
            jest.mocked(vscode.window.showInputBox)
                .mockResolvedValueOnce('https://example.com/repo.git')
                .mockResolvedValueOnce('repo');
            jest.mocked(vscode.tasks.executeTask).mockImplementationOnce(() => {
                throw new Error('task fail');
            });

            await executeCommand(ProjectClone.remoteCloneCommand);

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('task fail'),
            );
        });

        it("doesn't show error when task ends successfully", async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            jest.mocked(vscode.workspace).getWorkspaceFolder.mockReturnValue(
                workspaceFolders[0],
            );
            jest.mocked(vscode.Task).mockReturnValue(taskExec.task);
            jest.mocked(vscode.window.showInputBox)
                .mockResolvedValueOnce('https://example.com/repo.git')
                .mockResolvedValueOnce('repo');
            jest.mocked(vscode.tasks.executeTask).mockResolvedValueOnce(
                taskExec,
            );
            const onDidEndTaskProcessEmitter =
                new vscode.EventEmitter<vscode.TaskProcessEndEvent>();
            mutable(vscode.tasks).onDidEndTaskProcess =
                onDidEndTaskProcessEmitter.event;

            await executeCommand(ProjectClone.remoteCloneCommand);
            onDidEndTaskProcessEmitter.fire({
                execution: taskExec,
                exitCode: 0,
            });
            await waitImmediate();

            expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
        });

        it('shows error when task ends with non-zero exit code', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            jest.mocked(vscode.workspace).getWorkspaceFolder.mockReturnValue(
                workspaceFolders[0],
            );
            jest.mocked(vscode.Task).mockReturnValue(taskExec.task);
            jest.mocked(vscode.window.showInputBox)
                .mockResolvedValueOnce('https://example.com/repo.git')
                .mockResolvedValueOnce('repo');
            jest.mocked(vscode.tasks.executeTask).mockResolvedValueOnce(
                taskExec,
            );
            const onDidEndTaskProcessEmitter =
                new vscode.EventEmitter<vscode.TaskProcessEndEvent>();
            mutable(vscode.tasks).onDidEndTaskProcess =
                onDidEndTaskProcessEmitter.event;

            await executeCommand(ProjectClone.remoteCloneCommand);
            onDidEndTaskProcessEmitter.fire({
                execution: taskExec,
                exitCode: 1,
            });
            await waitImmediate();

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Clone task "Clone repo" failed with exit code 1.',
            );
        });
    });

    describe('cloneLocalProject', () => {
        it('shows error when no workspace folder open', async () => {
            await executeCommand(ProjectClone.localCloneCommand);

            const errMsg =
                'No workspace folder is open. Please open a folder to clone the project into.';
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(errMsg);
        });

        it('returns early when no folder selected', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            jest.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce(
                undefined,
            );

            await executeCommand(ProjectClone.localCloneCommand);

            expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
            expect(vscode.tasks.executeTask).not.toHaveBeenCalled();
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
            expect(vscode.tasks.executeTask).not.toHaveBeenCalled();
        });

        it('creates task and runs clone command for local path', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            jest.mocked(vscode.workspace).getWorkspaceFolder.mockReturnValue(
                workspaceFolders[0],
            );
            jest.mocked(vscode.Task).mockReturnValue(taskExec.task);
            jest.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce([
                localTemplateUri,
            ]);
            jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
                'myproj',
            );

            await executeCommand(ProjectClone.localCloneCommand);

            expect(vscode.ShellExecution).toHaveBeenCalledWith(
                'topo',
                [
                    'clone',
                    path.join(workspaceUri.fsPath, 'myproj'),
                    `dir:${localTemplateUri.fsPath}`,
                ],
                { cwd: workspaceUri.fsPath },
            );
            expect(vscode.Task).toHaveBeenCalledWith(
                { type: 'shell', taskId: `${manifest.PACKAGE_NAME} clone` },
                expect.anything(),
                `Clone myproj`,
                manifest.DISPLAY_NAME,
                expect.any(vscode.ShellExecution),
            );
            expect(vscode.tasks.executeTask).toHaveBeenCalledWith(
                expect.objectContaining({
                    presentationOptions: expect.anything(),
                }),
            );
        });

        it('shows error when executeTask throws', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            jest.mocked(vscode.workspace).getWorkspaceFolder.mockReturnValue(
                workspaceFolders[0],
            );
            jest.mocked(vscode.Task).mockReturnValue(taskExec.task);
            jest.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce([
                localTemplateUri,
            ]);
            jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
                'myproj',
            );
            jest.mocked(vscode.tasks.executeTask).mockImplementationOnce(() => {
                throw new Error('task fail');
            });

            await executeCommand(ProjectClone.localCloneCommand);

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('task fail'),
            );
        });

        it('shows error when task ends with non-zero exit code', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            jest.mocked(vscode.workspace).getWorkspaceFolder.mockReturnValue(
                workspaceFolders[0],
            );
            jest.mocked(vscode.Task).mockReturnValue(taskExec.task);
            jest.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce([
                localTemplateUri,
            ]);
            jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
                'myproj',
            );
            jest.mocked(vscode.tasks.executeTask).mockResolvedValueOnce(
                taskExec,
            );
            const onDidEndTaskProcessEmitter =
                new vscode.EventEmitter<vscode.TaskProcessEndEvent>();
            mutable(vscode.tasks).onDidEndTaskProcess =
                onDidEndTaskProcessEmitter.event;

            await executeCommand(ProjectClone.localCloneCommand);
            onDidEndTaskProcessEmitter.fire({
                execution: taskExec,
                exitCode: 1,
            });
            await waitImmediate();

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Clone task "Clone myproj" failed with exit code 1.',
            );
        });
    });

    describe('cloneTemplateProject', () => {
        const templateList: TemplateDescription[] = [
            {
                name: 'template-alpha',
                url: '/templates/template-alpha',
                description: 'Template Apple description. Apple is a fruit.',
                ref: 'r',
                features: [],
            },
            {
                name: 'template-banana',
                url: '/templates/template-banana',
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

        const showQuickPickItemMock = vscode.window.showQuickPick as (
            items: readonly (vscode.QuickPickItem & {
                template: TemplateDescription;
            })[],
            options?: vscode.QuickPickOptions,
        ) => Thenable<
            | (vscode.QuickPickItem & { template: TemplateDescription })
            | undefined
        >;

        it('shows error when no workspace folder open', async () => {
            await executeCommand(ProjectClone.templateCloneCommand);

            const errMsg =
                'No workspace folder is open. Please open a folder to clone the project into.';
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(errMsg);
        });

        it('returns early when no template selected', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            topoCli.listTemplates.mockReturnValue(templateList);
            jest.mocked(vscode.window.showQuickPick).mockResolvedValueOnce(
                undefined,
            );

            await executeCommand(ProjectClone.templateCloneCommand);

            expect(vscode.tasks.executeTask).not.toHaveBeenCalled();
        });

        it('returns early when no project name provided', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            topoCli.listTemplates.mockReturnValue(templateList);
            jest.mocked(showQuickPickItemMock).mockResolvedValueOnce(
                templateQuickPickItems[0],
            );
            jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
                undefined,
            );

            await executeCommand(ProjectClone.templateCloneCommand);

            expect(vscode.tasks.executeTask).not.toHaveBeenCalled();
        });

        it('creates task and runs clone command for template selection', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            topoCli.listTemplates.mockReturnValue(templateList);
            jest.mocked(vscode.workspace).getWorkspaceFolder.mockReturnValue(
                workspaceFolders[0],
            );
            jest.mocked(vscode.Task).mockReturnValue(taskExec.task);
            jest.mocked(showQuickPickItemMock).mockResolvedValueOnce(
                templateQuickPickItems[0],
            );
            jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
                'myproj',
            );

            await executeCommand(ProjectClone.templateCloneCommand);

            expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
                templateQuickPickItems,
                {
                    placeHolder: 'Select a template to clone',
                },
            );
            expect(vscode.window.showInputBox).toHaveBeenCalledWith({
                prompt: 'Enter the project name',
                value: templateQuickPickItems[0].label,
            });
            expect(vscode.ShellExecution).toHaveBeenCalledWith(
                'topo',
                [
                    'clone',
                    path.join(workspaceUri.fsPath, 'myproj'),
                    'template:template-alpha',
                ],
                { cwd: workspaceUri.fsPath },
            );
            expect(vscode.Task).toHaveBeenCalledWith(
                { type: 'shell', taskId: `${manifest.PACKAGE_NAME} clone` },
                expect.anything(),
                `Clone myproj`,
                manifest.DISPLAY_NAME,
                expect.any(vscode.ShellExecution),
            );
            expect(vscode.tasks.executeTask).toHaveBeenCalledWith(
                expect.objectContaining({
                    presentationOptions: expect.anything(),
                }),
            );
        });

        it('shows error when executeTask throws', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            topoCli.listTemplates.mockReturnValue(templateList);
            jest.mocked(vscode.workspace).getWorkspaceFolder.mockReturnValue(
                workspaceFolders[0],
            );
            jest.mocked(vscode.Task).mockReturnValue(taskExec.task);
            jest.mocked(showQuickPickItemMock).mockResolvedValueOnce(
                templateQuickPickItems[0],
            );
            jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
                'myproj',
            );
            jest.mocked(vscode.tasks.executeTask).mockImplementationOnce(() => {
                throw new Error('task fail');
            });

            await executeCommand(ProjectClone.templateCloneCommand);

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('task fail'),
            );
        });

        it('shows error when task ends with non-zero exit code', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            topoCli.listTemplates.mockReturnValue(templateList);
            jest.mocked(vscode.workspace).getWorkspaceFolder.mockReturnValue(
                workspaceFolders[0],
            );
            jest.mocked(vscode.Task).mockReturnValue(taskExec.task);
            jest.mocked(showQuickPickItemMock).mockResolvedValueOnce(
                templateQuickPickItems[0],
            );
            jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
                'myproj',
            );
            jest.mocked(vscode.tasks.executeTask).mockResolvedValueOnce(
                taskExec,
            );
            const onDidEndTaskProcessEmitter =
                new vscode.EventEmitter<vscode.TaskProcessEndEvent>();
            mutable(vscode.tasks).onDidEndTaskProcess =
                onDidEndTaskProcessEmitter.event;

            await executeCommand(ProjectClone.templateCloneCommand);
            onDidEndTaskProcessEmitter.fire({
                execution: taskExec,
                exitCode: 1,
            });
            await waitImmediate();

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Clone task "Clone myproj" failed with exit code 1.',
            );
        });
    });
});
