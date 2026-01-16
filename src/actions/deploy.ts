import * as vscode from 'vscode';
import { logger } from '../util/logger';
import { Deployer } from '../deployer';

export type DeployerType = Pick<Deployer, 'start' | 'stop' | 'onStdoutData' | 'onStderrData' | 'onExit' | 'onError'>;

export class Deploy {

    constructor(
        private readonly deployer: DeployerType,
    ) {}

    public async deploy(
        composeFilePath: string,
    ): Promise<void> {
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Deploying...',
                cancellable: true,
            },
            async (_progress, token) => {
                token.onCancellationRequested(() => {
                    try {
                        this.deployer.stop();
                    } catch (err) {
                        logger.error('An error happened while trying to stop deployment', err);
                    }
                });
                return new Promise<void>((resolve, reject) => {
                    const disposables: vscode.Disposable[] = [];
                    disposables.push(
                        this.deployer.onStdoutData((data) => {
                            logger.info(data);
                        }),
                        this.deployer.onStderrData((data) => {
                            logger.error(data);
                        }),
                        this.deployer.onExit((code) => {
                            disposables.forEach(d => d.dispose());
                            if (code === 0) {
                                resolve();
                            } else {
                                reject(new Error(`Deploy operation exited with code ${code}`));
                            }
                        }),
                        this.deployer.onError((err: Error) => {
                            logger.error('An error happened during deployment', err);
                            disposables.forEach(d => d.dispose());
                            reject(err);
                        }),
                    );
                    this.deployer.start(composeFilePath)
                        .then(() => logger.show())
                        .catch((err: Error) => {
                            vscode.window.showErrorMessage(`An error happened while starting deployment`);
                            logger.error('Failed to start deployment', err);
                            disposables.forEach(d => d.dispose());
                            reject(err);
                        });
                });
            }
        );
    }
}
