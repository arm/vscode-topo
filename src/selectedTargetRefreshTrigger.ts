import * as vscode from 'vscode';
import { TargetController } from './controllers/targetController';
import { TargetModel } from './models/targetModel';
import { logger } from './util/logger';

type SelectedTargetDataRefresher = Pick<
    TargetController,
    'refreshSelectedTargetDataCommandHandler'
>;

export function registerSelectedTargetRefreshTrigger(
    targetModel: TargetModel,
    selectedTargetDataRefresher: SelectedTargetDataRefresher,
): vscode.Disposable {
    return targetModel.onSelectedChanged(() => {
        void selectedTargetDataRefresher
            .refreshSelectedTargetDataCommandHandler()
            .catch((err) => {
                logger.error(
                    'Failed to refresh selected target data after selection change',
                    err,
                );
            });
    });
}
