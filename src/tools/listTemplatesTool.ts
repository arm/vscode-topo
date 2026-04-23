import * as vscode from 'vscode';
import { TopoCli } from '../topoCli';

interface ListTemplatesInput {
    target?: string;
}

export class ListTemplatesTool implements vscode.LanguageModelTool<ListTemplatesInput> {
    constructor(private readonly topoCli: TopoCli) {}

    public async invoke(
        options: vscode.LanguageModelToolInvocationOptions<ListTemplatesInput>,
        _token: vscode.CancellationToken,
    ): Promise<vscode.LanguageModelToolResult> {
        const templates = this.topoCli.listTemplates(options.input.target);
        const formatted = templates.map(
            (t) =>
                `- **${t.name}**: ${t.description} (url: ${t.url}, ref: ${t.ref}${t.compatibility ? `, compatibility: ${t.compatibility}` : ''})`,
        );
        const text =
            formatted.length > 0
                ? formatted.join('\n')
                : 'No templates available.';
        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(text),
        ]);
    }

    public async prepareInvocation(
        _options: vscode.LanguageModelToolInvocationPrepareOptions<ListTemplatesInput>,
        _token: vscode.CancellationToken,
    ): Promise<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: 'Listing available Topo templates…',
        };
    }
}
