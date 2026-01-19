import * as vscode from 'vscode';
import { logger } from '../util/logger';
import { Deployer } from '../deployer';
import * as manifest from '../manifest';
import { getErrorMessage } from '../util/getErrorMessage';

export type DeployerType = Pick<Deployer, 'start' | 'stop' | 'onStdoutData' | 'onStderrData' | 'onExit' | 'onError'>;

export class Deploy {

    public static readonly deployCommand = `${manifest.PACKAGE_NAME}.deploy.context`;

    constructor(
        private readonly context: Pick<vscode.ExtensionContext, 'subscriptions'>,
        private readonly deployer: DeployerType,
    ) {}

    public activate(): void {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(Deploy.deployCommand, this.handleDeployCommand.bind(this))
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
            void vscode.window.showErrorMessage(`${errorMsg}: ${getErrorMessage(err)}`);
        }
    }

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
                            logger.error('Failed to start deployment', err);
                            disposables.forEach(d => d.dispose());
                            reject(err);
                        });
                });
            }
        );
    }
}
