import * as vscode from 'vscode';
import { Deploy } from '../actions/deploy';
import { CloneProjectOptions, ProjectClone } from '../projectClone';
import { TargetStore } from '../target/targetStore';
import { TopoCli } from '../topoCli';

interface ListTemplatesInput {
    target?: string;
    templateName?: string;
    projectName?: string;
    deploy?: boolean;
    composeFilePath?: string;
}

export class ListTemplatesTool implements vscode.LanguageModelTool<ListTemplatesInput> {
    constructor(
        private readonly topoCli: TopoCli,
        private readonly targetStore?: TargetStore,
        private readonly projectClone?: ProjectClone,
        private readonly deployAction?: Deploy,
    ) {}

    public async invoke(
        options: vscode.LanguageModelToolInvocationOptions<ListTemplatesInput>,
        _token: vscode.CancellationToken,
    ): Promise<vscode.LanguageModelToolResult> {
        const { templateName, projectName, deploy, composeFilePath } =
            options.input;
        if (deploy) {
            const composeFile =
                composeFilePath ?? (await this.findComposeFile());

            if (!composeFile) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        'No compose file found in the workspace. Provide composeFilePath or open a workspace with a compose.yaml file.',
                    ),
                ]);
            }
            if (!this.deployAction) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        'Cannot deploy from this tool because the Topo deploy implementation is not available.',
                    ),
                ]);
            }

            try {
                await this.deployAction.deploy(composeFile);
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        `Deployment started for ${composeFile} through the Topo deploy tool. Check the terminal for progress.`,
                    ),
                ]);
            } catch (error: unknown) {
                const message =
                    error instanceof Error ? error.message : String(error);
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        `Deployment failed: ${message}`,
                    ),
                ]);
            }
        }

        const target =
            options.input.target?.trim() ||
            (await this.targetStore?.getSelectedTarget());
        const templates = this.topoCli.listTemplates(target);

        if (templateName?.trim()) {
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
            if (!this.projectClone) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        'Cannot clone from this tool because the Topo clone implementation is not available.',
                    ),
                ]);
            }

            const cloneOptions: CloneProjectOptions = {
                runPostCloneAction: false,
                ...(projectName?.trim() ? { projectName } : {}),
            };
            const success = await this.projectClone.cloneProjectFromSource(
                {
                    type: 'git',
                    url: template.url,
                },
                cloneOptions,
            );
            const message = success
                ? `Successfully cloned template "${template.name}" through the Topo clone tool.`
                : 'Clone was cancelled or failed.';
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(message),
            ]);
        }

        const formatted = templates.map(
            (t) =>
                `- **${t.name}**: ${t.description} (ref: ${t.ref}${t.compatibility ? `, compatibility: ${t.compatibility}` : ''}). Clone with this tool using \`templateName: "${t.name}"\`, or with \`topo_clone\` / \`topoClone\`.`,
        );
        const text =
            formatted.length > 0
                ? [
                      'Available Topo examples/templates:',
                      ...formatted,
                      'To clone one, call this same examples/templates tool with `templateName`, or call `topo_clone` (tool reference `topoClone`) with `templateName`. Do not run `git clone` or `topo clone` directly.',
                      'To deploy the current project, call this same examples/templates tool with `deploy: true` and optional `composeFilePath`, or call `topo_deployProject`. Do not run `topo deploy` directly.',
                  ].join('\n')
                : 'No templates available.';
        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(text),
        ]);
    }

    public async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<ListTemplatesInput>,
        _token: vscode.CancellationToken,
    ): Promise<vscode.PreparedToolInvocation> {
        if (options.input.deploy) {
            const file = options.input.composeFilePath ?? 'compose.yaml';
            return {
                invocationMessage: `Deploying ${file} to target…`,
                confirmationMessages: {
                    title: 'Deploy Topo Project',
                    message: `Deploy ${file} to the selected target through the Topo deploy tool?`,
                },
            };
        }

        const templateName = options.input.templateName?.trim();
        if (templateName) {
            return {
                invocationMessage: `Cloning Topo template "${templateName}"…`,
                confirmationMessages: {
                    title: 'Clone Topo Template',
                    message: `Clone the Topo template "${templateName}" through the Topo clone tool?`,
                },
            };
        }

        return {
            invocationMessage: 'Listing available Topo templates…',
        };
    }

    private async findComposeFile(): Promise<string | undefined> {
        const files = await vscode.workspace.findFiles(
            '**/compose{,.*}.yaml',
            '**/node_modules/**',
            1,
        );
        return files[0]?.fsPath;
    }
}
