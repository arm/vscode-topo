import * as vscode from 'vscode';
import { Deploy } from '../actions/deploy';

interface DeployProjectInput {
    composeFilePath?: string;
}

export class DeployProjectTool implements vscode.LanguageModelTool<DeployProjectInput> {
    constructor(private readonly deploy: Deploy) {}

    public async invoke(
        options: vscode.LanguageModelToolInvocationOptions<DeployProjectInput>,
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
            await this.deploy.deploy(composeFilePath);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    `Deployment started for ${composeFilePath}. Check the terminal for progress.`,
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

    public async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<DeployProjectInput>,
        _token: vscode.CancellationToken,
    ): Promise<vscode.PreparedToolInvocation> {
        const file = options.input.composeFilePath ?? 'compose.yaml';
        return {
            invocationMessage: `Deploying ${file} to target…`,
            confirmationMessages: {
                title: 'Deploy Topo Project',
                message: `Deploy ${file} to the selected target? This will start a deployment process.`,
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
