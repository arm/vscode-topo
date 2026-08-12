import os from 'node:os';
import * as vscode from 'vscode';
import { execFile } from '../util/exec';
import { TopoSkillStatus } from '../util/types';

export const TOPO_SKILL_NAME = 'topo-cli-location';
export const TOPO_SKILL_AGENTS = ['codex', 'claude-code'] as const;
export type TopoSkillAgent = (typeof TOPO_SKILL_AGENTS)[number];
export const TOPO_SKILL_AGENT_LABELS: Readonly<Record<TopoSkillAgent, string>> =
    {
        codex: 'Codex',
        'claude-code': 'Claude Code',
    };

const SKILL_FILE_NAME = 'SKILL.md';

interface ListedSkill {
    name: string;
    path: string;
    agents: string[];
}

interface TopoSkillOptions {
    userHomeUri?: vscode.Uri;
    platform?: NodeJS.Platform;
    environment?: NodeJS.ProcessEnv;
}

function isListedSkill(value: unknown): value is ListedSkill {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const skill = value as Partial<ListedSkill>;
    return (
        typeof skill.name === 'string' &&
        typeof skill.path === 'string' &&
        Array.isArray(skill.agents) &&
        skill.agents.every((agent) => typeof agent === 'string')
    );
}

function rawStringsAreEqual(first: Uint8Array, second: Uint8Array): boolean {
    return Buffer.from(first).equals(Buffer.from(second));
}

export class TopoSkill {
    private readonly bundledDirectoryUri: vscode.Uri;
    private readonly platform: NodeJS.Platform;
    private readonly installationDirectoryByAgent: Readonly<
        Record<TopoSkillAgent, vscode.Uri>
    >;
    public readonly userHomePath: string;

    constructor(extensionUri: vscode.Uri, options: TopoSkillOptions = {}) {
        const userHomeUri =
            options.userHomeUri ?? vscode.Uri.file(os.homedir());
        const configuredClaudeHome = (
            options.environment ?? process.env
        ).CLAUDE_CONFIG_DIR?.trim();
        const claudeHomeUri = configuredClaudeHome
            ? vscode.Uri.file(configuredClaudeHome)
            : vscode.Uri.joinPath(userHomeUri, '.claude');
        this.bundledDirectoryUri = vscode.Uri.joinPath(
            extensionUri,
            'skills',
            TOPO_SKILL_NAME,
        );
        this.installationDirectoryByAgent = {
            codex: vscode.Uri.joinPath(
                userHomeUri,
                '.agents',
                'skills',
                TOPO_SKILL_NAME,
            ),
            'claude-code': vscode.Uri.joinPath(
                claudeHomeUri,
                'skills',
                TOPO_SKILL_NAME,
            ),
        };
        this.userHomePath = userHomeUri.fsPath;
        this.platform = options.platform ?? process.platform;
    }

    public async getStatus(): Promise<TopoSkillStatus> {
        const listedSkills = await this.listInstalledSkills(TOPO_SKILL_AGENTS);
        if (listedSkills.length === 0) {
            return 'missing';
        }

        return (await this.getCurrentSkills(listedSkills)).length > 0
            ? 'installed'
            : 'outdated';
    }

    public async areAgentsInstalled(
        agents: readonly TopoSkillAgent[],
    ): Promise<boolean> {
        const currentSkills = await this.getCurrentSkills(
            await this.listInstalledSkills(agents),
        );
        return agents.every((agent) =>
            currentSkills.some((skill) =>
                skill.agents.includes(TOPO_SKILL_AGENT_LABELS[agent]),
            ),
        );
    }

    private async listInstalledSkills(
        agents: readonly TopoSkillAgent[],
    ): Promise<ListedSkill[]> {
        const npx = this.platform === 'win32' ? 'npx.cmd' : 'npx';
        const { stdout } = await execFile(
            npx,
            [
                '--yes',
                'skills',
                'list',
                '--global',
                '--agent',
                ...agents,
                '--json',
            ],
            {
                cwd: this.userHomePath,
                encoding: 'utf8',
                windowsHide: true,
            },
        );
        const listedSkills: unknown = JSON.parse(stdout);
        if (
            !Array.isArray(listedSkills) ||
            !listedSkills.every(isListedSkill)
        ) {
            throw new Error('Unexpected output from skills list');
        }
        const agentLabels = new Set(
            agents.map((agent) => TOPO_SKILL_AGENT_LABELS[agent]),
        );
        return listedSkills.filter(
            (skill) =>
                skill.name === TOPO_SKILL_NAME &&
                skill.agents.some((agent) => agentLabels.has(agent)),
        );
    }

    private async getCurrentSkills(
        listedSkills: readonly ListedSkill[],
    ): Promise<ListedSkill[]> {
        if (listedSkills.length === 0) {
            return [];
        }
        const bundledSkill = await vscode.workspace.fs.readFile(
            vscode.Uri.joinPath(this.bundledDirectoryUri, SKILL_FILE_NAME),
        );
        const isCurrent = await Promise.all(
            listedSkills.map(async ({ path }) => {
                const installedSkill = await vscode.workspace.fs.readFile(
                    vscode.Uri.joinPath(vscode.Uri.file(path), SKILL_FILE_NAME),
                );
                return rawStringsAreEqual(bundledSkill, installedSkill);
            }),
        );
        return listedSkills.filter((_, index) => isCurrent[index]);
    }

    public get bundledDirectoryPath(): string {
        return this.bundledDirectoryUri.fsPath;
    }

    public getInstallationDirectoryPath(agent: TopoSkillAgent): string {
        return this.installationDirectoryByAgent[agent].fsPath;
    }
}
