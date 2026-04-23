import * as vscode from 'vscode';
import { TargetStore } from '../target/targetStore';
import { defaultSshConfigPath, getHosts } from '../util/ssh';

interface AddTargetInput {
    ssh: string;
}

const looksLikeHostname = (value: string): boolean => !value.includes('@');

export class AddTargetTool implements vscode.LanguageModelTool<AddTargetInput> {
    constructor(private readonly targetStore: TargetStore) {}

    public async invoke(
        options: vscode.LanguageModelToolInvocationOptions<AddTargetInput>,
        _token: vscode.CancellationToken,
    ): Promise<vscode.LanguageModelToolResult> {
        const { ssh } = options.input;
        if (!ssh?.trim()) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    'Please provide an SSH connection string (e.g. root@192.168.1.1 or a hostname).',
                ),
            ]);
        }

        const trimmed = ssh.trim();

        if (looksLikeHostname(trimmed)) {
            const knownHosts = await getHosts(defaultSshConfigPath);
            const match = knownHosts.find(
                (h) => h.toLowerCase() === trimmed.toLowerCase(),
            );
            if (!match) {
                const suggestions =
                    knownHosts.length > 0
                        ? ` Known hosts: ${knownHosts.join(', ')}.`
                        : '';
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        `"${trimmed}" was not found in ~/.ssh/config.${suggestions} You can still add it as a target if the hostname is reachable, or provide a full connection string (e.g. user@host).`,
                    ),
                ]);
            }
        }

        try {
            await this.targetStore.addTarget(trimmed);
            await this.targetStore.setSelected(trimmed);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    `Target "${trimmed}" added and selected.`,
                ),
            ]);
        } catch (error: unknown) {
            const message =
                error instanceof Error ? error.message : String(error);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    `Failed to add target: ${message}`,
                ),
            ]);
        }
    }

    public async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<AddTargetInput>,
        _token: vscode.CancellationToken,
    ): Promise<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: `Adding target "${options.input.ssh}"…`,
            confirmationMessages: {
                title: 'Add Topo Target',
                message: `Add "${options.input.ssh}" as a deployment target and select it?`,
            },
        };
    }
}
