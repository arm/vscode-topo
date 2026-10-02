import * as vscode from 'vscode';
import { HostModel } from '../models/hostModel';
import { TopoCli } from '../services/topoCli';
import { TopoSkill } from '../services/topoSkill';
import { errored, loaded, loading } from '../util/loadable';
import { getHealthChecks } from '../util/healthReport';
import { Config } from '../services/config';
import { CONTAINER_ENGINES } from '../manifest';
import { showAndLogError } from '../util/showAndLog';
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
        this.hostModel.setContainerEngine(this.config.getContainerEngine());
    }

    public async selectContainerEngineCommandHandler(): Promise<void> {
        const currentEngine = this.config.getContainerEngine();
        const selected = await vscode.window.showQuickPick(
            CONTAINER_ENGINES.map((engine) => ({
                label: engine,
                description: engine === currentEngine ? 'Current' : undefined,
                detail:
                    engine === 'docker'
                        ? 'Default container engine'
                        : undefined,
                engine,
            })),
            { title: 'Select Container Engine' },
        );
        if (!selected || selected.engine === currentEngine) {
            return;
        }
        try {
            await this.config.setContainerEngine(selected.engine);
        } catch (error) {
            showAndLogError('Failed to change container engine', error);
        }
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
            const health = await this.healthRefresh.run(() =>
                this.topoCli.hostHealth(),
            );
            if (health !== undefined) {
                this.hostModel.setHealth(
                    loaded(getHealthChecks(health, 'host')),
                );
            }
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
