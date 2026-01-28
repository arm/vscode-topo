import * as vscode from 'vscode';
import { logger } from '../util/logger';
import { showAndLogError } from '../util/showAndLogError';
import { ContainersManager } from '../workloadPlacement/containersManager';
import { ContainerOpenInBrowser } from '../actions/containerOpenInBrowser';
import { AttachVsCode } from '../actions/attachVsCode';
import { AttachShell } from '../actions/attachShell';
import { TargetStore } from '../workloadPlacement/targetStore';
import { isTopoError } from '../errors/topoError';
import { MessagePoster } from '../util/types';

export class BoardDashboardMessageHandler {
    constructor(
        private readonly containersManager: Pick<
            ContainersManager,
            | 'getContainersData'
            | 'getBoardState'
            | 'startContainer'
            | 'stopContainer'
            | 'deleteContainer'
        >,
        private readonly targetStore: Pick<TargetStore, 'getSelectedTarget'>,
        private readonly containerOpenInBrowser: Pick<
            ContainerOpenInBrowser,
            'openContainerInBrowser'
        >,
        private readonly attachVsCode: Pick<AttachVsCode, 'attachVsCode'>,
        private readonly attachShell: Pick<
            AttachShell,
            'attachShell' | 'attachSSH'
        >,
    ) {}

    public async renderBoardDashboard(
        messagePoster: MessagePoster,
    ): Promise<void> {
        const containersData = await this.containersManager.getContainersData();
        const boardState = await this.containersManager.getBoardState();
        const target = await this.targetStore.getSelectedTarget();
        if (!target) {
            logger.error('No target selected, cannot render board dashboard');
            return;
        }
        await messagePoster.postMessage({
            type: 'render-board-dashboard',
            boardState,
            containersData,
            target,
        });
    }

    /**
     * Handle incoming messages from the webview
     */
    public async handleMessage(
        messagePoster: MessagePoster,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        e: any,
    ): Promise<void> {
        try {
            switch (e.type) {
                case 'start-container':
                    try {
                        await this.containersManager.startContainer(
                            e.containerId,
                        );
                    } catch (err: unknown) {
                        if (isTopoError(err) && err.code === 'DOCKER') {
                            showAndLogError(
                                `Failed to start the container ${e.containerId}`,
                                err,
                            );
                            return;
                        }
                        throw err;
                    }
                    logger.info(
                        `Container ${e.containerId} started successfully`,
                    );
                    await this.renderBoardDashboard(messagePoster);
                    break;
                case 'stop-container':
                    try {
                        await this.containersManager.stopContainer(
                            e.containerId,
                        );
                    } catch (err: unknown) {
                        if (isTopoError(err) && err.code === 'DOCKER') {
                            showAndLogError(
                                `Failed to stop the container ${e.containerId}`,
                                err,
                            );
                            return;
                        }
                        throw err;
                    }
                    logger.info(
                        `Container ${e.containerId} stopped successfully`,
                    );
                    await this.renderBoardDashboard(messagePoster);
                    break;
                case 'delete-container':
                    try {
                        await this.containersManager.deleteContainer(
                            e.containerId,
                        );
                    } catch (err: unknown) {
                        if (isTopoError(err) && err.code === 'DOCKER') {
                            showAndLogError(
                                `Failed to delete the container ${e.containerId}`,
                                err,
                            );
                            return;
                        }
                        throw err;
                    }
                    logger.info(
                        `Container ${e.containerId} deleted successfully`,
                    );
                    await this.renderBoardDashboard(messagePoster);
                    break;
                case 'open-container-in-browser': {
                    const containersData =
                        await this.containersManager.getContainersData();
                    const container = containersData.find(
                        (c) => c.id === e.containerId,
                    );
                    if (!container) {
                        logger.warn(
                            `Container with ID ${e.containerId} not found`,
                        );
                    } else {
                        const result =
                            await this.containerOpenInBrowser.openContainerInBrowser(
                                container,
                            );
                        if (result === 'no-web-ports') {
                            vscode.window.showWarningMessage(
                                `No web ports found for container ${e.containerId}`,
                            );
                        }
                    }
                    break;
                }
                case 'attach-vscode': {
                    const containersData =
                        await this.containersManager.getContainersData();
                    const container = containersData.find(
                        (c) => c.id === e.containerId,
                    );
                    if (!container) {
                        logger.warn(
                            `Container with ID ${e.containerId} not found`,
                        );
                    } else {
                        try {
                            await this.attachVsCode.attachVsCode(container);
                        } catch (err: unknown) {
                            if (isTopoError(err) && err.code === 'DOCKER') {
                                showAndLogError(
                                    `Failed to attach VS Code to the container ${e.containerId}`,
                                    err,
                                );
                                return;
                            }
                            throw err;
                        }
                    }
                    break;
                }
                case 'attach-shell': {
                    const containersData =
                        await this.containersManager.getContainersData();
                    const container = containersData.find(
                        (c) => c.id === e.containerId,
                    );
                    if (!container) {
                        logger.warn(
                            `Container with ID ${e.containerId} not found`,
                        );
                    } else {
                        this.attachShell.attachShell(container);
                    }
                    break;
                }
                case 'attach-ssh':
                    try {
                        await this.attachShell.attachSSH();
                    } catch (err: unknown) {
                        if (isTopoError(err) && err.code === 'DOCKER') {
                            showAndLogError(
                                'Failed to attach SSH to the board',
                                err,
                            );
                            return;
                        }
                        throw err;
                    }
                    break;
                case 'board-dashboard-webview-ready':
                    await this.renderBoardDashboard(messagePoster);
                    break;
                default:
                    logger.warn(`Unknown message type: ${e.type}`);
            }
        } catch (err: unknown) {
            const errorMsg =
                'Unexpected error handling message from board dashboard webview';
            showAndLogError(errorMsg, err);
        }
    }
}
