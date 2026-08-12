import * as vscode from 'vscode';
import { ListedSkill, NpxSkills } from './npxSkills';

export const TOPO_SKILL_NAME = 'topo-cli-location';

const SKILL_FILE_NAME = 'SKILL.md';
const INSTALL_TASK_NAME = 'Install Topo Agent Skill';

export type TopoSkillStatus = 'installed' | 'missing' | 'outdated';

export interface TopoSkillAgentStatus {
    readonly name: string;
    readonly paths: readonly string[];
    readonly status: Exclude<TopoSkillStatus, 'missing'>;
}

export interface TopoSkillReport {
    readonly status: TopoSkillStatus;
    readonly agents: readonly TopoSkillAgentStatus[];
}

function rawStringsAreEqual(first: Uint8Array, second: Uint8Array): boolean {
    return Buffer.from(first).equals(Buffer.from(second));
}

export class TopoSkill {
    private readonly bundledDirectoryUri: vscode.Uri;

    constructor(
        extensionUri: vscode.Uri,
        private readonly npxSkills: NpxSkills,
    ) {
        this.bundledDirectoryUri = vscode.Uri.joinPath(
            extensionUri,
            'skills',
            TOPO_SKILL_NAME,
        );
    }

    public async getReport(): Promise<TopoSkillReport> {
        const listedSkills = (await this.npxSkills.listGlobal()).filter(
            (skill) =>
                skill.name === TOPO_SKILL_NAME && skill.agents.length > 0,
        );
        if (listedSkills.length === 0) {
            return { status: 'missing', agents: [] };
        }

        const bundledSkill = await vscode.workspace.fs.readFile(
            vscode.Uri.joinPath(this.bundledDirectoryUri, SKILL_FILE_NAME),
        );
        const listedSkillStatuses = await Promise.all(
            listedSkills.map(async (skill) => ({
                skill,
                status: rawStringsAreEqual(
                    bundledSkill,
                    await this.readSkillFile(skill),
                )
                    ? ('installed' as const)
                    : ('outdated' as const),
            })),
        );

        const agentsByName = new Map<string, TopoSkillAgentStatus>();
        for (const { skill, status } of listedSkillStatuses) {
            for (const name of skill.agents) {
                const current = agentsByName.get(name);
                agentsByName.set(name, {
                    name,
                    paths: current
                        ? [...new Set([...current.paths, skill.path])]
                        : [skill.path],
                    status:
                        current?.status === 'outdated' || status === 'outdated'
                            ? 'outdated'
                            : 'installed',
                });
            }
        }

        const agents = [...agentsByName.values()].toSorted((first, second) =>
            first.name.localeCompare(second.name, undefined, {
                sensitivity: 'base',
            }),
        );
        return {
            status: agents.every(({ status }) => status === 'installed')
                ? 'installed'
                : 'outdated',
            agents,
        };
    }

    private async readSkillFile(skill: ListedSkill): Promise<Uint8Array> {
        return await vscode.workspace.fs.readFile(
            vscode.Uri.joinPath(vscode.Uri.file(skill.path), SKILL_FILE_NAME),
        );
    }

    public createInstallTask(): vscode.Task {
        return this.npxSkills.createAddGlobalTask(
            INSTALL_TASK_NAME,
            this.bundledDirectoryUri.fsPath,
        );
    }
}
