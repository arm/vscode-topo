import * as vscode from 'vscode';
import { Stop } from '../actions/stop';

interface StopProjectInput {
    composeFilePath?: string;
}

export class StopProjectTool implements vscode.LanguageModelTool<StopProjectInput> {
    constructor(private readonly stop: Stop) {}

    public async invoke(
        options: vscode.LanguageModelToolInvocationOptions<StopProjectInput>,
        _token: vscode.CancellationToken,
    ): Promise<vscode.LanguageModelToolResult> {
        const composeFilePath =
            options.input.composeFilePath ?? (await this.findComposeFile());

        if (!composeFilePath) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    'No compose file found in the workspace. Please provide a composeFilePath or open a workspace with a compose.yaml file.',
                ),
            ]);
        }

        try {
            await this.stop.stop(composeFilePath);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    `Stop started for ${composeFilePath}. Check the terminal for progress.`,
                ),
            ]);
        } catch (error: unknown) {
            const message =
                error instanceof Error ? error.message : String(error);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`Stop failed: ${message}`),
            ]);
        }
    }

    public async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<StopProjectInput>,
        _token: vscode.CancellationToken,
    ): Promise<vscode.PreparedToolInvocation> {
        const file = options.input.composeFilePath ?? 'compose.yaml';
        return {
            invocationMessage: `Stopping ${file} on target...`,
            confirmationMessages: {
                title: 'Stop Topo Project',
                message: `Stop services for ${file} on the selected target?`,
            },
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
