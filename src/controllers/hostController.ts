import { HostModel } from '../models/hostModel';
import { TopoCli } from '../services/topoCli';
import {
    TopoSkill,
    TopoSkillAgent,
    TOPO_SKILL_AGENTS,
} from '../services/topoSkill';
import { errored, loaded, loading } from '../util/loadable';

export class HostController {
    constructor(
        private readonly hostModel: HostModel,
        private readonly topoCli: TopoCli,
        private readonly topoSkill: TopoSkill,
    ) {
        void this.refreshHostCommandHandler();
    }

    public async refreshHostCommandHandler(): Promise<void> {
        await Promise.all([
            this.refreshHealthCommandHandler(),
            this.refreshSkillStatus(),
        ]);
    }

    public async refreshHealthCommandHandler(): Promise<void> {
        this.hostModel.setHealth(loading(this.hostModel.health));
        try {
            const health = await this.topoCli.hostHealth();
            this.hostModel.setHealth(loaded(health));
        } catch (e) {
            this.hostModel.setHealth(errored(e));
        }
    }

    public async refreshSkillStatus(): Promise<void> {
        await Promise.all(
            TOPO_SKILL_AGENTS.map((agent) =>
                this.refreshAgentSkillStatus(agent),
            ),
        );
    }

    private async refreshAgentSkillStatus(
        agent: TopoSkillAgent,
    ): Promise<void> {
        this.hostModel.setSkillStatus(
            agent,
            loading(this.hostModel.skillStatuses[agent]),
        );
        try {
            const status = await this.topoSkill.getStatus(agent);
            this.hostModel.setSkillStatus(agent, loaded(status));
        } catch (error) {
            this.hostModel.setSkillStatus(agent, errored(error));
        }
    }
}
