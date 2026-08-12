import { HostModel } from '../models/hostModel';
import { TopoCli } from '../services/topoCli';
import { TopoSkill } from '../services/topoSkill';
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
        this.hostModel.setSkillReport(loading(this.hostModel.skillReport));
        try {
            const report = await this.topoSkill.getReport();
            this.hostModel.setSkillReport(loaded(report));
        } catch (error) {
            this.hostModel.setSkillReport(errored(error));
        }
    }
}
