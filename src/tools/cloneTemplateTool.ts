import * as vscode from 'vscode';
import { ProjectClone } from '../projectClone';
import { CloneSource, TopoCli } from '../topoCli';
import { TargetStore } from '../target/targetStore';

interface CloneTemplateInput {
    templateName?: string;
    gitUrl?: string;
    projectName?: string;
}

export class CloneTemplateTool implements vscode.LanguageModelTool<CloneTemplateInput> {
    constructor(
        private readonly topoCli: TopoCli,
        private readonly projectClone: ProjectClone,
        private readonly targetStore: TargetStore,
    ) {}

    public async invoke(
        options: vscode.LanguageModelToolInvocationOptions<CloneTemplateInput>,
        _token: vscode.CancellationToken,
    ): Promise<vscode.LanguageModelToolResult> {
        const { templateName, gitUrl, projectName } = options.input;
        const cloneOptions = projectName?.trim() ? { projectName } : undefined;

        if (gitUrl) {
            const success = await this.cloneProject(
                {
                    type: 'git',
                    url: gitUrl,
                },
                cloneOptions,
            );
            const message = success
                ? `Successfully cloned project from ${gitUrl}.`
                : 'Clone was cancelled or failed.';
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(message),
            ]);
        }

        if (templateName) {
            const selectedTarget = await this.targetStore.getSelectedTarget();
            const templates = this.topoCli.listTemplates(selectedTarget);
            const template = templates.find(
                (t) => t.name.toLowerCase() === templateName.toLowerCase(),
            );
            if (!template) {
                const available = templates.map((t) => t.name).join(', ');
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        `Template "${templateName}" not found. Available templates: ${available || 'none'}`,
                    ),
                ]);
            }
            const success = await this.cloneProject(
                {
                    type: 'git',
                    url: template.url,
                },
                cloneOptions,
            );
            const message = success
                ? `Successfully cloned template "${template.name}" from ${template.url}.`
                : 'Clone was cancelled or failed.';
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(message),
            ]);
        }

        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(
                'Please provide either a templateName or a gitUrl to clone.',
            ),
        ]);
    }

    public async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<CloneTemplateInput>,
        _token: vscode.CancellationToken,
    ): Promise<vscode.PreparedToolInvocation> {
        const { templateName, gitUrl } = options.input;
        const source = templateName ?? gitUrl ?? 'a template';
        return {
            invocationMessage: `Cloning project from ${source}…`,
            confirmationMessages: {
                title: 'Clone Topo Project',
                message: `Clone a project from ${source}? This will create a new folder on disk.`,
            },
        };
    }

    private cloneProject(
        cloneSource: CloneSource,
        cloneOptions: { projectName: string } | undefined,
    ): Promise<boolean> {
        return cloneOptions
            ? this.projectClone.cloneProjectFromSource(
                  cloneSource,
                  cloneOptions,
              )
            : this.projectClone.cloneProjectFromSource(cloneSource);
    }
}
