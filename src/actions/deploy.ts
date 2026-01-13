import * as vscode from 'vscode';
import { logger } from '../util/logger';
import { getErrorMessage } from '../util/getErrorMessage';
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
                        logger.error('An error happened:');
                        logger.error(err);
                    }
                });
                return new Promise<void>((resolve, reject) => {
                    const disposables: vscode.Disposable[] = [];
                    const errorHandler = (err: Error) => {
                        logger.error('An error happened:');
                        logger.error(err);
                        disposables.forEach(d => d.dispose());
                        reject(err);
                    };
                    disposables.push(
                        this.deployer.onStdoutData((data) => {
                            logger.info(data.toString());
                        }),
                        this.deployer.onStderrData((data) => {
                            logger.error(data.toString());
                        }),
                        this.deployer.onExit((code) => {
                            disposables.forEach(d => d.dispose());
                            if (code === 0) {
                                resolve();
                            } else {
                                reject(new Error(`Deploy operation exited with code ${code}`));
                            }
                        }),
                        this.deployer.onError(errorHandler),
                    );
                    this.deployer.start(composeFilePath)
                        .then(() => logger.show())
                        .catch((err: Error) => {
                            vscode.window.showErrorMessage(`An error happened: ${getErrorMessage(err)}`);
                            disposables.forEach(d => d.dispose());
                            reject(err);
                        });
                });
            }
        );
    }
}
