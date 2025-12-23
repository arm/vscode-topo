import path from 'path';
import * as vscode from 'vscode';
import * as manifest from './manifest';
import { ProjectClone, ProjectClonerBinary } from './projectClone';

/* eslint-disable @typescript-eslint/no-explicit-any */

const waitImmediate = () => new Promise<void>(resolve => setTimeout(() => resolve(), 0));

const executeCommand = async function (command: string, ...args: unknown[]) {
    const registeredCommands = (vscode.commands.registerCommand as jest.Mock).mock.calls;
    const rawHandler = registeredCommands.find((c: unknown[]) => c[0] === command);
    const handler = rawHandler![1] as (...args: unknown[]) => Promise<void>;
    await handler(...args);
    await waitImmediate();
};

const subscriptions: vscode.Disposable[] = [];

const workspacePath = path.join('home', 'workspace');
const workspaceFolders = [{ uri: { fsPath: workspacePath } }];

jest.mock('vscode');

describe('ProjectClone', () => {
    let projectClone: ProjectClone;
    const topoCli: jest.Mocked<ProjectClonerBinary> = {
        getCloneCommand: jest.fn(),
    };

    beforeEach(async () => {
        jest.resetAllMocks();
        (vscode.workspace as any).workspaceFolders = undefined;
        subscriptions.length = 0;
        projectClone = new ProjectClone({ subscriptions }, topoCli);
        await projectClone.activate();
    });

    it('registers the command on activate', async () => {
        expect((vscode.commands.registerCommand as jest.Mock)).toHaveBeenCalled();
        expect(subscriptions.length).toBeGreaterThan(0);
    });

    it('shows error when no workspace folder open', async () => {
        await executeCommand(ProjectClone.remoteCloneCommand);

        const errMsg = 'No workspace folder is open. Please open a folder to clone the project into.';
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(errMsg);
    });

    it('return early when no clone url provided', async () => {
        (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/home/workspace' } }];
        (vscode.window.showInputBox as jest.Mock).mockResolvedValueOnce(undefined);

        await executeCommand(ProjectClone.remoteCloneCommand);

        expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
        expect(vscode.tasks.executeTask).not.toHaveBeenCalled();
    });

    it('shows error when invalid clone url provided', async () => {
        (vscode.workspace.workspaceFolders as any) = workspaceFolders;
        (vscode.window.showInputBox as jest.Mock)
            .mockResolvedValueOnce('not-a-valid-url')
            .mockResolvedValueOnce('repo');

        await executeCommand(ProjectClone.remoteCloneCommand);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('is not a valid URL'));
    });

    it('returns early when no project name provided', async () => {
        (vscode.workspace.workspaceFolders as any) = workspaceFolders;
        (vscode.window.showInputBox as jest.Mock)
            .mockResolvedValueOnce('https://example.com/repo.git')
            .mockResolvedValueOnce(undefined);

        await executeCommand(ProjectClone.remoteCloneCommand);

        expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
        expect(vscode.tasks.executeTask).not.toHaveBeenCalled();
    });

    it('creates task and runs clone command on valid https git URL', async () => {
        (vscode.workspace.workspaceFolders as any) = workspaceFolders;
        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue({} as any);
        (vscode.Task as jest.Mock).mockReturnValue({});
        const cloneCmd = 'topo clone repo git:https://example.com/repo.git'.split(' ');
        topoCli.getCloneCommand.mockReturnValue(cloneCmd);
        (vscode.window.showInputBox as jest.Mock)
            .mockResolvedValueOnce('https://example.com/repo.git')
            .mockResolvedValueOnce('repo');

        await executeCommand(ProjectClone.remoteCloneCommand);

        expect(topoCli.getCloneCommand).toHaveBeenCalledWith(path.join(workspacePath, 'repo'), { url: 'https://example.com/repo.git', type: 'git' });
        expect(vscode.ShellExecution).toHaveBeenCalledWith('topo', 'clone repo git:https://example.com/repo.git'.split(' '), { cwd: workspacePath });
        expect(vscode.Task).toHaveBeenCalledWith({ type: 'shell', taskId: `${manifest.PACKAGE_NAME}.remoteClone` }, expect.anything(), `Clone repo`, manifest.DISPLAY_NAME, expect.any(vscode.ShellExecution));
        expect(vscode.tasks.executeTask).toHaveBeenCalledWith(expect.objectContaining({ presentationOptions: expect.anything() }));
    });

    it('creates task and runs clone command on valid SSH git URL', async () => {
        (vscode.workspace.workspaceFolders as any) = workspaceFolders;
        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue({} as any);
        (vscode.Task as jest.Mock).mockReturnValue({});
        const cloneCmd = 'topo clone repo git:git@example.com:repo.git'.split(' ');
        topoCli.getCloneCommand.mockReturnValue(cloneCmd);
        (vscode.window.showInputBox as jest.Mock)
            .mockResolvedValueOnce('git@example.com:repo.git')
            .mockResolvedValueOnce('repo');

        await executeCommand(ProjectClone.remoteCloneCommand);

        expect(topoCli.getCloneCommand).toHaveBeenCalledWith(path.join(workspacePath, 'repo'), { url: 'git@example.com:repo.git', type: 'git' });
        expect(vscode.ShellExecution).toHaveBeenCalledWith('topo', 'clone repo git:git@example.com:repo.git'.split(' '), { cwd: workspacePath });
        expect(vscode.Task).toHaveBeenCalledWith({ type: 'shell', taskId: `${manifest.PACKAGE_NAME}.remoteClone` }, expect.anything(), `Clone repo`, manifest.DISPLAY_NAME, expect.any(vscode.ShellExecution));
        expect(vscode.tasks.executeTask).toHaveBeenCalledWith(expect.objectContaining({ presentationOptions: expect.anything()}));
    });

    it('shows error when executeTask throws', async () => {
        (vscode.workspace.workspaceFolders as any) = workspaceFolders;
        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue({} as any);
        (vscode.Task as jest.Mock).mockReturnValue({});
        const cloneCmd = 'topo clone repo git:https://example.com/repo.git'.split(' ');
        topoCli.getCloneCommand.mockReturnValue(cloneCmd);
        (vscode.window.showInputBox as jest.Mock)
            .mockResolvedValueOnce('https://example.com/repo.git')
            .mockResolvedValueOnce('repo');
        (vscode.tasks.executeTask as jest.Mock).mockImplementationOnce(() => { throw new Error('task fail'); });

        await executeCommand(ProjectClone.remoteCloneCommand);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('task fail'));
    });

    it('doesn\'t show error when task ends successfully', async () => {
        (vscode.workspace.workspaceFolders as any) = workspaceFolders;
        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue({} as any);
        (vscode.Task as jest.Mock).mockReturnValue({});
        const cloneCmd = 'topo clone repo git:https://example.com/repo.git'.split(' ');
        topoCli.getCloneCommand.mockReturnValue(cloneCmd);
        (vscode.window.showInputBox as jest.Mock)
            .mockResolvedValueOnce('https://example.com/repo.git')
            .mockResolvedValueOnce('repo');
        const taskExec = {} as any;
        (vscode.tasks.executeTask as jest.Mock).mockResolvedValueOnce(taskExec);
        const onDidEndTaskProcessEmitter = new vscode.EventEmitter<vscode.TaskProcessEndEvent>();
        (vscode.tasks as any).onDidEndTaskProcess = onDidEndTaskProcessEmitter.event;

        await executeCommand(ProjectClone.remoteCloneCommand);
        onDidEndTaskProcessEmitter.fire({ execution: taskExec, exitCode: 0 });
        await waitImmediate();

        expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
    });

    it('shows error when task ends with non-zero exit code', async () => {
        (vscode.workspace.workspaceFolders as any) = workspaceFolders;
        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue({} as any);
        (vscode.Task as jest.Mock).mockReturnValue({});
        const cloneCmd = 'topo clone repo git:https://example.com/repo.git'.split(' ');
        topoCli.getCloneCommand.mockReturnValue(cloneCmd);
        (vscode.window.showInputBox as jest.Mock)
            .mockResolvedValueOnce('https://example.com/repo.git')
            .mockResolvedValueOnce('repo');
        const taskExec = {} as any;
        (vscode.tasks.executeTask as jest.Mock).mockResolvedValueOnce(taskExec);
        const onDidEndTaskProcessEmitter = new vscode.EventEmitter<vscode.TaskProcessEndEvent>();
        (vscode.tasks as any).onDidEndTaskProcess = onDidEndTaskProcessEmitter.event;

        await executeCommand(ProjectClone.remoteCloneCommand);
        onDidEndTaskProcessEmitter.fire({ execution: taskExec, exitCode: 1 });
        await waitImmediate();

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Clone task "Clone repo" failed with exit code 1.');
    });

});
