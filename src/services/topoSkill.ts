import * as vscode from 'vscode';
import { TopoSkillStatus } from '../util/types';
import { ListedSkill, NpxSkills } from './npxSkills';

export const TOPO_SKILL_NAME = 'topo-cli-location';
export const TOPO_SKILL_AGENTS = ['codex', 'claude-code'] as const;
export type TopoSkillAgent = (typeof TOPO_SKILL_AGENTS)[number];
export type TopoSkillStatuses = Readonly<
    Record<TopoSkillAgent, TopoSkillStatus>
>;
export const TOPO_SKILL_AGENT_LABELS: Readonly<Record<TopoSkillAgent, string>> =
    {
        codex: 'Codex',
        'claude-code': 'Claude Code',
    };

const SKILL_FILE_NAME = 'SKILL.md';

interface TopoSkillOptions {
    userHomeUri?: vscode.Uri;
    environment?: NodeJS.ProcessEnv;
}

function rawStringsAreEqual(first: Uint8Array, second: Uint8Array): boolean {
    return Buffer.from(first).equals(Buffer.from(second));
}

export class TopoSkill {
    private readonly bundledDirectoryUri: vscode.Uri;
    private readonly installationDirectoryByAgent: Readonly<
        Record<TopoSkillAgent, vscode.Uri>
    >;
    constructor(
        extensionUri: vscode.Uri,
        private readonly npxSkills: NpxSkills,
        options: TopoSkillOptions = {},
    ) {
        const userHomeUri =
            options.userHomeUri ?? vscode.Uri.file(npxSkills.userHomePath);
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
    }

    public async getStatuses(): Promise<TopoSkillStatuses> {
        const [codex, claudeCode] = await Promise.all([
            this.getStatusForAgent('codex'),
            this.getStatusForAgent('claude-code'),
        ]);
        return {
            codex,
            'claude-code': claudeCode,
        };
    }

    public async areAgentsInstalled(
        agents: readonly TopoSkillAgent[],
    ): Promise<boolean> {
        const statuses = await Promise.all(
            agents.map((agent) => this.getStatusForAgent(agent)),
        );
        return statuses.every((status) => status === 'installed');
    }

    private async getStatusForAgent(
        agent: TopoSkillAgent,
    ): Promise<TopoSkillStatus> {
        const listedSkills = await this.listInstalledSkills(agent);
        if (listedSkills.length === 0) {
            return 'missing';
        }
        if ((await this.getCurrentSkills(listedSkills)).length > 0) {
            return 'installed';
        }
        return 'outdated';
    }

    private async listInstalledSkills(
        agent: TopoSkillAgent,
    ): Promise<ListedSkill[]> {
        const listedSkills = await this.npxSkills.list([agent]);
        const agentLabel = TOPO_SKILL_AGENT_LABELS[agent];
        return listedSkills.filter(
            (skill) =>
                skill.name === TOPO_SKILL_NAME &&
                skill.agents.includes(agentLabel),
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
