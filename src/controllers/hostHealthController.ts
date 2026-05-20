import { HostHealthModel } from '../models/hostHealthModel';
import { TopoCli } from '../topoCli';

export class HostHealthController {
    constructor(
        private readonly hostHealthModel: HostHealthModel,
        private readonly topoCli: TopoCli,
    ) {}

    public activate(): void {
        this.refresh();
    }

    public refresh(): void {
        this.hostHealthModel.health = this.topoCli.hostHealth();
    }
}
