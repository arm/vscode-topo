import { HostModel } from '../models/hostModel';
import { TopoCli } from '../topoCli';

export class HostController {
    constructor(
        private readonly hostModel: HostModel,
        private readonly topoCli: TopoCli,
    ) {
        this.refreshHealth();
    }

    public async refreshHealth(): Promise<void> {
        this.hostModel.setHealth({
            status: 'loading',
            placeholder: this.hostModel.health,
        });
        try {
            const health = await this.topoCli.hostHealth();
            this.hostModel.setHealth({ status: 'loaded', data: health });
        } catch (e) {
            this.hostModel.setHealth({
                status: 'error',
                error: e instanceof Error ? e : new Error(String(e)),
            });
        }
    }
}
