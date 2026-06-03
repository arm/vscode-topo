import * as manifest from '../manifest';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import { logger } from '../util/logger';
import { TopoCli } from '../topoCli';
import { TransientDocumentProvider } from '../util/transientDocumentProvider';
import { showAndLogError } from '../util/showAndLogError';
import { HealthCheckResult } from '../topoCliSchema';

export class TargetHealth {
    constructor(
        private readonly topoCli: TopoCli,
        private readonly healthDocumentProvider: TransientDocumentProvider,
    ) {}

    public async inspectHealthCommandHandler(treeNode: unknown): Promise<void> {
        if (!(treeNode instanceof TargetTreeItem)) {
            const errMsg = `Invalid target type for inspect health: expected TargetTreeItem but received:`;
            logger.error(errMsg, treeNode);
            return;
        }

        if (!treeNode.selected) {
            const errMsg = `Invalid target for inspect health: expected selected TargetTreeItem but received:`;
            logger.error(errMsg, treeNode);
            return;
        }

        let health: HealthCheckResult;
        try {
            health = await this.topoCli.health(treeNode.target);
        } catch (err) {
            return showAndLogError('Failed to get health for target', err);
        }

        const safeTargetSsh = treeNode.target.replace(/[^a-zA-Z0-9._-]/g, '_');
        const fileName = `${manifest.PACKAGE_NAME}-${safeTargetSsh}-health-${Date.now()}.json`;
        const documentUri = this.healthDocumentProvider.createUri(fileName);
        const content = JSON.stringify(health.target, null, 4);
        await this.healthDocumentProvider.open(documentUri, content);
    }
}
