import * as vscode from 'vscode';
import { logger } from '../util/logger';
import { Deployer } from '../deployer';
import * as manifest from '../manifest';
import { getErrorMessage } from '../util/getErrorMessage';

export type DeployerType = Pick<
    Deployer,
    'start' | 'stop' | 'onStdoutData' | 'onStderrData' | 'onExit' | 'onError'
>;

export class Deploy {
    public static readonly deployCommand = `${manifest.PACKAGE_NAME}.deploy.context`;

    constructor(
        private readonly context: Pick<
            vscode.ExtensionContext,
            'subscriptions'
        >,
        private readonly deployer: DeployerType,
    ) {}

    public activate(): void {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                Deploy.deployCommand,
                this.handleDeployCommand.bind(this),
            ),
        );
    }

    private async handleDeployCommand(resource?: vscode.Uri): Promise<void> {
        if (!resource) {
            throw new Error('No compose file selected for deployment');
        }
        try {
            await this.deploy(resource.fsPath);
        } catch (err) {
            const errorMsg = 'Error executing deploy command';
            logger.error(errorMsg, err);
            void vscode.window.showErrorMessage(
                `${errorMsg}: ${getErrorMessage(err)}`,
            );
        }
    }

    public async deploy(composeFilePath: string): Promise<void> {
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
                        logger.error(
                            'An error happened while trying to stop deployment',
                            err,
                        );
                    }
                });
                return new Promise<void>((resolve, reject) => {
                    const disposables: vscode.Disposable[] = [];
                    const cleanup = () =>
                        disposables.forEach((d) => d.dispose());
                    disposables.push(
                        this.deployer.onStdoutData((data) => {
                            logger.info(data);
                        }),
                        this.deployer.onStderrData((data) => {
                            logger.error(data);
                        }),
                        this.deployer.onExit((code) => {
                            cleanup();
                            if (
                                token.isCancellationRequested &&
                                (code === null || code === 0)
                            ) {
                                logger.info('Deployment cancelled');
                                resolve();
                                return;
                            }
                            if (code === 0) {
                                resolve();
                            } else {
                                reject(
                                    new Error(
                                        `Deploy operation exited with code ${code}`,
                                    ),
                                );
                            }
                        }),
                        this.deployer.onError((err: Error) => {
                            cleanup();
                            const errorMsg = token.isCancellationRequested
                                ? 'Deployment error after cancellation'
                                : 'Deployment error';
                            logger.error(errorMsg, err);
                            reject(err);
                        }),
                    );
                    this.deployer
                        .start(composeFilePath)
                        .then(() => logger.show())
                        .catch((err: Error) => {
                            cleanup();
                            logger.error('Failed to start deployment', err);
                            reject(err);
                        });
                });
            },
        );
    }
}
