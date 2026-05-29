import { PACKAGE_NAME } from '../manifest';
import { HostModel } from '../models/hostModel';
import { TopoCli } from '../topoCli';
import { showAndLogError } from '../util/showAndLogError';
import { TransientDocumentProvider } from '../util/transientDocumentProvider';

export class HostController {
    constructor(
        private readonly hostModel: HostModel,
        private readonly topoCli: TopoCli,
        private readonly healthDocumentProvider: TransientDocumentProvider,
    ) {
        this.refreshHealthCommandHandler();
    }

    public async refreshHealthCommandHandler(): Promise<void> {
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

    public async openHealthDocumentCommandHandler(): Promise<void> {
        const fileName = `${PACKAGE_NAME}-host-health-${Date.now()}.json`;

        try {
            const health = await this.topoCli.hostHealth();
            const content = JSON.stringify(health?.host ?? null, null, 4);
            const documentUri = this.healthDocumentProvider.createUri(fileName);
            await this.healthDocumentProvider.open(documentUri, content);
        } catch (err) {
            showAndLogError('Failed to inspect host health', err);
        }
    }
}
