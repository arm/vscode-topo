import * as vscode from 'vscode';
import { TargetStore } from '../target/targetStore';
import { defaultSshConfigPath, getHosts } from '../util/ssh';

interface AddTargetInput {
    ssh: string;
}

interface KnownHostMatch {
    host?: string;
    ambiguousHosts?: string[];
}

const looksLikeHostname = (value: string): boolean => !value.includes('@');

const normalizeHostName = (value: string): string =>
    value.toLowerCase().replace(/[\s._-]+/g, '');

const findKnownHost = (
    requestedHost: string,
    knownHosts: string[],
): KnownHostMatch => {
    const exactMatch = knownHosts.find(
        (host) => host.toLowerCase() === requestedHost.toLowerCase(),
    );
    if (exactMatch) {
        return { host: exactMatch };
    }

    const normalizedRequestedHost = normalizeHostName(requestedHost);
    const normalizedMatch = knownHosts.find(
        (host) => normalizeHostName(host) === normalizedRequestedHost,
    );
    if (normalizedMatch) {
        return { host: normalizedMatch };
    }

    const fuzzyMatches = knownHosts.filter((host) => {
        const normalizedHost = normalizeHostName(host);
        return (
            normalizedHost.length >= 3 &&
            normalizedRequestedHost.length >= 3 &&
            (normalizedRequestedHost.includes(normalizedHost) ||
                normalizedHost.includes(normalizedRequestedHost))
        );
    });
    if (fuzzyMatches.length === 1) {
        return { host: fuzzyMatches[0] };
    }
    return fuzzyMatches.length > 1 ? { ambiguousHosts: fuzzyMatches } : {};
};

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
        let target = trimmed;

        if (looksLikeHostname(trimmed)) {
            const knownHosts = await getHosts(defaultSshConfigPath);
            const match = findKnownHost(trimmed, knownHosts);
            if (!match.host) {
                const suggestions =
                    match.ambiguousHosts && match.ambiguousHosts.length > 0
                        ? ` Matching hosts: ${match.ambiguousHosts.join(', ')}.`
                        : knownHosts.length > 0
                          ? ` Known hosts: ${knownHosts.join(', ')}.`
                          : '';
                const message =
                    match.ambiguousHosts && match.ambiguousHosts.length > 0
                        ? `"${trimmed}" matched multiple hosts in ~/.ssh/config.`
                        : `"${trimmed}" was not found in ~/.ssh/config.`;
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        `${message}${suggestions} You can still add it as a target if the hostname is reachable, or provide a full connection string (e.g. user@host).`,
                    ),
                ]);
            }
            target = match.host;
        }

        try {
            await this.targetStore.addTarget(target);
            await this.targetStore.setSelected(target);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    `Target "${target}" added and selected.`,
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
