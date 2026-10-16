import * as vscode from 'vscode';
import { HostModel } from '../models/hostModel';
import { TopoCli } from '../services/topoCli';
import { TopoSkill } from '../services/topoSkill';
import { errored, loaded, loading } from '../util/loadable';
import { getHostHealth } from '../util/healthReport';
import { Config } from '../services/config';
import { LatestAbortableWork } from '../util/latestAbortableWork';

export class HostController implements vscode.Disposable {
    private readonly healthRefresh = new LatestAbortableWork();

    constructor(
        private readonly hostModel: HostModel,
        private readonly topoCli: TopoCli,
        private readonly topoSkill: TopoSkill,
        private readonly config: Config,
    ) {
        this.refreshContainerEngine();
        void this.refreshHostCommandHandler();
    }

    public refreshContainerEngine(): void {
        this.hostModel.setContainerEngine(
            this.config.getContainerEngineSetting(),
            process.env.TOPO_ENGINE,
        );
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
            await this.healthRefresh.run(async (signal) => {
                const health = await this.topoCli.hostHealth();
                signal.throwIfAborted();
                this.hostModel.setHealth(loaded(getHostHealth(health)));
            });
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

    public dispose(): void {
        this.healthRefresh.dispose();
    }
}
