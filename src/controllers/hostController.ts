import { HostModel } from '../models/hostModel';
import { TopoCli } from '../topoCli';
import { errored, loaded, loading } from '../util/loadable';

export class HostController {
    constructor(
        private readonly hostModel: HostModel,
        private readonly topoCli: TopoCli,
    ) {
        this.refreshHealthCommandHandler();
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
}
