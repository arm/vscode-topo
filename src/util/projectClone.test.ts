import fs from 'node:fs';
import path from 'node:path';
import * as vscode from 'vscode';
import { mock } from 'vitest-mock-extended';
import { WrappedError } from '../errors/wrappedError';
import { TopoCli } from '../services/topoCli';
import { ProjectDescription } from '../services/topoCliSchema';
import { showAndLogError } from './showAndLog';
import { mutable } from './test/mutable';
import {
    getFirstSentence,
    handleCompletedClone,
    promptForLocalCloneSource,
    promptForRemoteCloneSource,
    resolveProjectName,
    selectDestinationPath,
} from './projectClone';

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

const destinationUri = vscode.Uri.file(path.resolve('home', 'destination'));
const localProjectUri = vscode.Uri.file(path.resolve('path', 'to', 'source'));
const workspaceUri = vscode.Uri.file(path.resolve('home', 'workspace'));
const workspaceFolders = [{ uri: workspaceUri, name: 'workspace', index: 0 }];

describe('project clone utilities', () => {
    const topoCli = mock<TopoCli>();

    beforeEach(() => {
        vi.resetAllMocks();
        mutable(vscode.workspace).workspaceFolders = undefined;
        vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    });

    afterEach(() => vi.restoreAllMocks());

    it('gets the first sentence of a catalog description', () => {
        expect(
            getFirstSentence('Project Apple description. Apple is a fruit.'),
        ).toBe('Project Apple description.');
        expect(getFirstSentence('  No terminator  ')).toBe('No terminator');
    });

    it('prompts for local source and destination folders', async () => {
        vi.mocked(vscode.window.showOpenDialog)
            .mockResolvedValueOnce([localProjectUri])
            .mockResolvedValueOnce([destinationUri]);

        await expect(promptForLocalCloneSource()).resolves.toEqual({
            type: 'dir',
            path: localProjectUri.fsPath,
        });
        await expect(selectDestinationPath()).resolves.toBe(
            destinationUri.fsPath,
        );
    });

    it('returns undefined when folder prompts are cancelled', async () => {
        vi.mocked(vscode.window.showOpenDialog).mockResolvedValue(undefined);

        await expect(promptForLocalCloneSource()).resolves.toBeUndefined();
        await expect(selectDestinationPath()).resolves.toBeUndefined();
    });

    it('uses an available default project name without prompting', async () => {
        await expect(
            resolveProjectName(destinationUri.fsPath, 'project'),
        ).resolves.toBe('project');

        expect(fs.existsSync).toHaveBeenCalledWith(
            path.join(destinationUri.fsPath, 'project'),
        );
        expect(vscode.window.showInputBox).not.toHaveBeenCalled();
    });

    it('prompts for a project name when the default path exists', async () => {
        vi.mocked(fs.existsSync).mockReturnValueOnce(true);
        vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
            'other-project',
        );

        await expect(
            resolveProjectName(destinationUri.fsPath, 'project'),
        ).resolves.toBe('other-project');

        expect(vscode.window.showInputBox).toHaveBeenCalledWith({
            prompt: 'Enter the project name',
            value: 'project',
            validateInput: expect.any(Function),
        });
    });

    describe('remote source prompt', () => {
        const projectList: ProjectDescription[] = [
            {
                name: 'project-alpha',
                url: 'https://example.com/projects/project-alpha.git',
                description: 'Project Alpha description. More detail.',
                ref: 'r',
                features: [],
            },
            {
                name: 'project-beta',
                url: 'https://example.com/projects/project-beta.git',
                description: 'Project Beta description. More detail.',
                ref: 'r',
                features: [],
            },
        ];

        it('returns a selected catalog project', async () => {
            topoCli.listProjects.mockResolvedValue(projectList);
            const { quickPick, acceptItem } = mockRemoteQuickPick();

            const sourcePromise = promptForRemoteCloneSource(
                topoCli,
                'me@example.com',
            );
            await vi.waitFor(() => expect(quickPick.busy).toBe(false));
            acceptItem(1);

            await expect(sourcePromise).resolves.toEqual({
                type: 'git',
                url: projectList[1].url,
            });
            expect(topoCli.listProjects).toHaveBeenCalledWith('me@example.com');
            expect(quickPick.dispose).toHaveBeenCalledOnce();
        });

        it('offers a trimmed custom URL before catalog projects', async () => {
            const url = 'https://example.com/custom.git';
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
            expect(quickPick.items[0]).toEqual({
                label: '$(cloud-download) Custom URL',
                description: url,
                url,
            });
        });

        it('falls back to the local catalog after a target CLI error', async () => {
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
            await vi.waitFor(() => expect(quickPick.busy).toBe(false));
            quickPick.hide();

            await expect(sourcePromise).resolves.toBeUndefined();
            expect(topoCli.listProjects).toHaveBeenNthCalledWith(
                1,
                'unhealthy-target',
            );
            expect(topoCli.listProjects).toHaveBeenNthCalledWith(2);
        });

        it('keeps custom URL entry available when catalog loading fails', async () => {
            const error = new Error('command failed');
            const url = 'https://example.com/custom.git';
            topoCli.listProjects.mockRejectedValueOnce(error);
            const { enterValue, acceptItem } = mockRemoteQuickPick();

            const sourcePromise = promptForRemoteCloneSource(topoCli);
            enterValue(url);
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
    });

    describe('post-clone action', () => {
        const repositoryPath = path.resolve('home', 'destination', 'project');

        it('opens the project in the current window', async () => {
            showInformationMessageMock.mockResolvedValueOnce('Open');

            await handleCompletedClone(repositoryPath);

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'vscode.openFolder',
                vscode.Uri.file(repositoryPath),
                { forceReuseWindow: true },
            );
        });

        it('opens the project in a new window', async () => {
            showInformationMessageMock.mockResolvedValueOnce(
                'Open in New Window',
            );

            await handleCompletedClone(repositoryPath);

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'vscode.openFolder',
                vscode.Uri.file(repositoryPath),
                { forceNewWindow: true },
            );
        });

        it('offers to add the project to the current workspace', async () => {
            mutable(vscode.workspace).workspaceFolders = workspaceFolders;
            showInformationMessageMock.mockResolvedValueOnce(
                'Add to Workspace',
            );

            await handleCompletedClone(repositoryPath);

            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                'Would you like to open the cloned repository, or add it to the current workspace?',
                { modal: true },
                'Open',
                'Open in New Window',
                'Add to Workspace',
            );
            expect(
                vscode.workspace.updateWorkspaceFolders,
            ).toHaveBeenCalledWith(workspaceFolders.length, 0, {
                uri: vscode.Uri.file(repositoryPath),
            });
        });
    });
});
