import { HostModel } from '../models/hostModel';
import { TopoCli } from '../topoCli';

export class HostController {
    constructor(
        private readonly hostModel: HostModel,
        private readonly topoCli: TopoCli,
    ) {
        this.refreshHealth();
    }

    public refreshHealth(): void {
        this.hostModel.setHealth(this.topoCli.hostHealth());
    }
}
