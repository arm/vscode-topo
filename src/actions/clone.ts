import * as vscode from 'vscode';
import { isWrappedError } from '../errors/wrappedError';
import { showAndLogError } from '../util/showAndLogError';
import * as manifest from '../manifest';
import { TopoCli } from '../topoCli';
import { TemplateDescription } from '../topoCliSchema';
import { TargetStore } from '../target/targetStore';
import { cloneProjectFromSource } from '../util/projectClone';

const getFirstSentence = (text: string): string => {
    const trimmed = text.trim();
    const match = trimmed.match(/^.*?[.!?](?=\s|$)/);
    return (match ? match[0] : trimmed).trim();
};

const getTemplateOfChoice = async (
    topoCli: TopoCli,
    sshTarget?: string,
): Promise<TemplateDescription | undefined> => {
    const templates = topoCli.listTemplates(sshTarget);
    const templateItems = templates.map((template) => ({
        label: template.name,
        detail: getFirstSentence(template.description),
        template,
    }));

    const selectedTemplateItem = await vscode.window.showQuickPick(
        templateItems,
        {
            placeHolder: 'Select a template to clone',
        },
    );
    if (!selectedTemplateItem) {
        return undefined;
    }

    return selectedTemplateItem.template;
};

const getLocalSourcePath = async (): Promise<string | undefined> => {
    const cloneSourceUri = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select Project to Clone',
    });
    if (!cloneSourceUri || cloneSourceUri.length === 0) {
        return undefined;
    }
    return cloneSourceUri[0].fsPath;
};

export class Clone implements vscode.Disposable {
    public static remoteCloneCommand = `${manifest.PACKAGE_NAME}.remoteClone`;
    public static localCloneCommand = `${manifest.PACKAGE_NAME}.localClone`;
    public static templateCloneCommand = `${manifest.PACKAGE_NAME}.templateClone`;
    private disposables: vscode.Disposable[] = [];

    constructor(
        private readonly topoCli: TopoCli,
        private readonly targetStore: TargetStore,
    ) {}

    public activate() {
        this.disposables.push(
            vscode.commands.registerCommand(
                Clone.remoteCloneCommand,
                this.wrapCloneCommandWithCloneErrorHandling(
                    this.cloneRemoteProject,
                ),
            ),
            vscode.commands.registerCommand(
                Clone.localCloneCommand,
                this.wrapCloneCommandWithCloneErrorHandling(
                    this.cloneLocalProject,
                ),
            ),
            vscode.commands.registerCommand(
                Clone.templateCloneCommand,
                this.wrapCloneCommandWithCloneErrorHandling(
                    this.cloneTemplateProject,
                ),
            ),
        );
    }

    private wrapCloneCommandWithCloneErrorHandling(
        commandHandler: (this: Clone) => Promise<void>,
    ): () => Promise<void> {
        return async () => {
            try {
                await commandHandler.call(this);
            } catch (error: unknown) {
                if (isWrappedError(error, ['CLONE', 'CLI'])) {
                    return showAndLogError('Failed to clone project', error);
                }
                throw error;
            }
        };
    }

    private async cloneTemplateProject(): Promise<void> {
        const selectedTarget = this.targetStore.getSelectedTarget();
        const selectedTemplate = await getTemplateOfChoice(
            this.topoCli,
            selectedTarget,
        );
        if (!selectedTemplate) {
            return;
        }
        await cloneProjectFromSource({
            type: 'git',
            url: selectedTemplate.url,
        });
    }

    private async cloneLocalProject(): Promise<void> {
        const cloneSourcePath = await getLocalSourcePath();
        if (!cloneSourcePath) {
            return;
        }
        await cloneProjectFromSource({
            type: 'dir',
            path: cloneSourcePath,
        });
    }

    private async cloneRemoteProject(): Promise<void> {
        const cloneSourceRemoteUrl = await vscode.window.showInputBox({
            prompt: 'Enter the git URL to clone from',
        });
        if (!cloneSourceRemoteUrl) {
            return;
        }
        await cloneProjectFromSource({
            type: 'git',
            url: cloneSourceRemoteUrl,
        });
    }

    public dispose(): void {
        for (const disposable of [...this.disposables].reverse()) {
            disposable.dispose();
        }
        this.disposables = [];
    }
}
