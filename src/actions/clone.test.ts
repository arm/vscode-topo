import * as vscode from 'vscode';
import { mock } from 'jest-mock-extended';
import { Clone } from './clone';
import { TopoCli } from '../topoCli';
import { TargetStore } from '../target/targetStore';
import { TemplateDescription } from '../topoCliSchema';
import { cloneProjectFromSource } from '../util/projectClone';
import { showAndLogError } from '../util/showAndLogError';
import { WrappedError } from '../errors/wrappedError';

jest.mock('../util/projectClone', () => ({
    cloneProjectFromSource: jest.fn(),
}));
jest.mock('../util/showAndLogError', () => ({
    showAndLogError: jest.fn(),
}));

const cloneProjectFromSourceMock = jest.mocked(cloneProjectFromSource);

const executeCommand = async function (command: string, ...args: unknown[]) {
    const registeredCommands = jest.mocked(vscode.commands.registerCommand).mock
        .calls;
    const handler = registeredCommands.find(
        (c: unknown[]) => c[0] === command,
    )?.[1];
    await handler!(...args);
};

const createTemplateFixture = (): {
    templates: TemplateDescription[];
    quickPickItems: {
        label: string;
        detail: string;
        template: TemplateDescription;
    }[];
} => {
    const templates: TemplateDescription[] = [
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

    return {
        templates,
        quickPickItems: templates.map((template) => ({
            label: template.name,
            detail: template.description.split('.')[0] + '.',
            template,
        })),
    };
};

describe('Clone', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('registers clone commands on activate', () => {
        const topoCli = mock<TopoCli>();
        const targetStore = mock<TargetStore>();
        const clone = new Clone(topoCli, targetStore);

        clone.activate();

        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            Clone.remoteCloneCommand,
            expect.any(Function),
        );
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            Clone.localCloneCommand,
            expect.any(Function),
        );
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            Clone.templateCloneCommand,
            expect.any(Function),
        );
    });

    it('clones from a remote git URL selected through the command prompt', async () => {
        const clone = new Clone(mock<TopoCli>(), mock<TargetStore>());
        clone.activate();
        jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
            'https://example.com/repo.git',
        );

        await executeCommand(Clone.remoteCloneCommand);

        expect(cloneProjectFromSourceMock).toHaveBeenCalledWith({
            type: 'git',
            url: 'https://example.com/repo.git',
        });
    });

    it('does not clone a remote project when URL entry is cancelled', async () => {
        const clone = new Clone(mock<TopoCli>(), mock<TargetStore>());
        clone.activate();
        jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
            undefined,
        );

        await executeCommand(Clone.remoteCloneCommand);

        expect(cloneProjectFromSourceMock).not.toHaveBeenCalled();
    });

    it('clones from a local source folder selected through the command prompt', async () => {
        const clone = new Clone(mock<TopoCli>(), mock<TargetStore>());
        clone.activate();
        const sourceUri = vscode.Uri.file('/path/to/source');
        jest.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce([
            sourceUri,
        ]);

        await executeCommand(Clone.localCloneCommand);

        expect(vscode.window.showOpenDialog).toHaveBeenCalledWith({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select Project to Clone',
        });
        expect(cloneProjectFromSourceMock).toHaveBeenCalledWith({
            type: 'dir',
            path: sourceUri.fsPath,
        });
    });

    it('does not clone a local project when source folder selection is cancelled', async () => {
        const clone = new Clone(mock<TopoCli>(), mock<TargetStore>());
        clone.activate();
        jest.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce(
            undefined,
        );

        await executeCommand(Clone.localCloneCommand);

        expect(cloneProjectFromSourceMock).not.toHaveBeenCalled();
    });

    it('clones the selected template for the selected target', async () => {
        const { templates, quickPickItems } = createTemplateFixture();
        const topoCli = mock<TopoCli>();
        const targetStore = mock<TargetStore>();
        targetStore.getSelectedTarget.mockReturnValue('me@example.com');
        topoCli.listTemplates.mockReturnValue(templates);
        const clone = new Clone(topoCli, targetStore);
        clone.activate();
        jest.mocked(vscode.window.showQuickPick).mockResolvedValueOnce(
            quickPickItems[0],
        );

        await executeCommand(Clone.templateCloneCommand);

        expect(topoCli.listTemplates).toHaveBeenCalledWith('me@example.com');
        expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
            quickPickItems,
            { placeHolder: 'Select a template to clone' },
        );
        expect(cloneProjectFromSourceMock).toHaveBeenCalledWith({
            type: 'git',
            url: templates[0].url,
        });
    });

    it('lists templates without a target when none is selected', async () => {
        const { templates } = createTemplateFixture();
        const topoCli = mock<TopoCli>();
        const targetStore = mock<TargetStore>();
        targetStore.getSelectedTarget.mockReturnValue(undefined);
        topoCli.listTemplates.mockReturnValue(templates);
        const clone = new Clone(topoCli, targetStore);
        clone.activate();
        jest.mocked(vscode.window.showQuickPick).mockResolvedValueOnce(
            undefined,
        );

        await executeCommand(Clone.templateCloneCommand);

        expect(topoCli.listTemplates).toHaveBeenCalledWith(undefined);
        expect(cloneProjectFromSourceMock).not.toHaveBeenCalled();
    });

    it('does not clone a template project when template selection is cancelled', async () => {
        const { templates } = createTemplateFixture();
        const topoCli = mock<TopoCli>();
        topoCli.listTemplates.mockReturnValue(templates);
        const clone = new Clone(topoCli, mock<TargetStore>());
        clone.activate();
        jest.mocked(vscode.window.showQuickPick).mockResolvedValueOnce(
            undefined,
        );

        await executeCommand(Clone.templateCloneCommand);

        expect(cloneProjectFromSourceMock).not.toHaveBeenCalled();
    });

    it('shows structured clone errors from command handlers', async () => {
        const clone = new Clone(mock<TopoCli>(), mock<TargetStore>());
        clone.activate();
        const error = new WrappedError('CLONE', 'Invalid URL');
        jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
            'not-a-valid-url',
        );
        cloneProjectFromSourceMock.mockRejectedValueOnce(error);

        await executeCommand(Clone.remoteCloneCommand);

        expect(showAndLogError).toHaveBeenCalledWith(
            'Failed to clone project',
            error,
        );
    });

    it('shows structured CLI errors from template listing', async () => {
        const topoCli = mock<TopoCli>();
        const error = new WrappedError('CLI', 'lscpu not found');
        topoCli.listTemplates.mockImplementation(() => {
            throw error;
        });
        const clone = new Clone(topoCli, mock<TargetStore>());
        clone.activate();

        await executeCommand(Clone.templateCloneCommand);

        expect(showAndLogError).toHaveBeenCalledWith(
            'Failed to clone project',
            error,
        );
        expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
        expect(cloneProjectFromSourceMock).not.toHaveBeenCalled();
    });

    it('propagates generic errors from template listing', async () => {
        const topoCli = mock<TopoCli>();
        topoCli.listTemplates.mockImplementation(() => {
            throw new Error('command failed');
        });
        const clone = new Clone(topoCli, mock<TargetStore>());
        clone.activate();

        await expect(
            executeCommand(Clone.templateCloneCommand),
        ).rejects.toThrow('command failed');

        expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
        expect(cloneProjectFromSourceMock).not.toHaveBeenCalled();
    });
});
