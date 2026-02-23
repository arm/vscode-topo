import * as vscode from 'vscode';
import { logger } from '../util/logger';
import { showAndLogError } from '../util/showAndLogError';
import { ContainersManager } from '../workloadPlacement/containersManager';
import type { ContainerItem } from '../util/types';
import { ContainerOpenInBrowser } from '../actions/containerOpenInBrowser';
import { AttachVsCode } from '../actions/attachVsCode';
import { AttachShell } from '../actions/attachShell';
import { TargetStore } from '../workloadPlacement/targetStore';
import { isTopoError } from '../errors/topoError';
import { isPlainObject } from '../util/isPlainObject';
import { MessagePoster } from '../util/types';

type StartContainerMessage = { type: 'start-container'; containerId: string };
type StopContainerMessage = { type: 'stop-container'; containerId: string };
type DeleteContainerMessage = { type: 'delete-container'; containerId: string };
type OpenContainerInBrowserMessage = {
    type: 'open-container-in-browser';
    containerId: string;
};
type AttachVsCodeMessage = { type: 'attach-vscode'; containerId: string };
type AttachShellMessage = { type: 'attach-shell'; containerId: string };
type AttachSshMessage = { type: 'attach-ssh' };
type BoardDashboardWebviewReadyMessage = {
    type: 'board-dashboard-webview-ready';
};

type BoardDashboardWebviewMessage =
    | StartContainerMessage
    | StopContainerMessage
    | DeleteContainerMessage
    | OpenContainerInBrowserMessage
    | AttachVsCodeMessage
    | AttachShellMessage
    | AttachSshMessage
    | BoardDashboardWebviewReadyMessage;

function parseBoardDashboardWebviewMessage(
    value: unknown,
): BoardDashboardWebviewMessage {
    if (!isPlainObject(value) || typeof value.type !== 'string') {
        throw new Error(
            'Invalid webview message: expected an object with a string "type" property',
        );
    }

    switch (value.type) {
        case 'start-container':
        case 'stop-container':
        case 'delete-container':
        case 'open-container-in-browser':
        case 'attach-vscode':
        case 'attach-shell': {
            if (typeof value.containerId !== 'string') {
                throw new Error(
                    `Invalid message for type "${value.type}": missing or invalid "containerId"`,
                );
            }
            return { type: value.type, containerId: value.containerId };
        }

        case 'attach-ssh':
        case 'board-dashboard-webview-ready':
            return { type: value.type };

        default:
            throw new Error(`Unknown message type: ${String(value.type)}`);
    }
}

export class BoardDashboardMessageHandler {
    constructor(
        private readonly containersManager: ContainersManager,
        private readonly targetStore: TargetStore,
        private readonly containerOpenInBrowser: ContainerOpenInBrowser,
        private readonly attachVsCode: AttachVsCode,
        private readonly attachShell: AttachShell,
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

    private async getContainerById(
        containerId: string,
    ): Promise<ContainerItem> {
        const containersData = await this.containersManager.getContainersData();
        const container = containersData.find((c) => c.id === containerId);
        if (!container) {
            throw new Error(`Container with ID ${containerId} not found`);
        }
        return container;
    }

    private async handleStartContainer(
        messagePoster: MessagePoster,
        containerId: string,
    ): Promise<void> {
        try {
            await this.containersManager.startContainer(containerId);
        } catch (err: unknown) {
            if (isTopoError(err) && err.code === 'DOCKER') {
                showAndLogError(
                    `Failed to start the container ${containerId}`,
                    err,
                );
                return;
            }
            throw err;
        }

        logger.info(`Container ${containerId} started successfully`);
        await this.renderBoardDashboard(messagePoster);
    }

    private async handleStopContainer(
        messagePoster: MessagePoster,
        containerId: string,
    ): Promise<void> {
        try {
            await this.containersManager.stopContainer(containerId);
        } catch (err: unknown) {
            if (isTopoError(err) && err.code === 'DOCKER') {
                showAndLogError(
                    `Failed to stop the container ${containerId}`,
                    err,
                );
                return;
            }
            throw err;
        }

        logger.info(`Container ${containerId} stopped successfully`);
        await this.renderBoardDashboard(messagePoster);
    }

    private async handleDeleteContainer(
        messagePoster: MessagePoster,
        containerId: string,
    ): Promise<void> {
        try {
            await this.containersManager.deleteContainer(containerId);
        } catch (err: unknown) {
            if (isTopoError(err) && err.code === 'DOCKER') {
                showAndLogError(
                    `Failed to delete the container ${containerId}`,
                    err,
                );
                return;
            }
            throw err;
        }

        logger.info(`Container ${containerId} deleted successfully`);
        await this.renderBoardDashboard(messagePoster);
    }

    private async handleOpenContainerInBrowser(
        containerId: string,
    ): Promise<void> {
        const container = await this.getContainerById(containerId);
        const result =
            await this.containerOpenInBrowser.openContainerInBrowser(container);

        if (result === 'no-web-ports') {
            vscode.window.showWarningMessage(
                `No web ports found for container ${containerId}`,
            );
        }
    }

    private async handleAttachVsCode(containerId: string): Promise<void> {
        const container = await this.getContainerById(containerId);
        try {
            await this.attachVsCode.attachVsCode(container);
        } catch (err: unknown) {
            if (isTopoError(err) && err.code === 'DOCKER') {
                showAndLogError(
                    `Failed to attach VS Code to the container ${containerId}`,
                    err,
                );
                return;
            }
            throw err;
        }
    }

    private async handleAttachShell(containerId: string): Promise<void> {
        const container = await this.getContainerById(containerId);
        this.attachShell.attachShell(container);
    }

    private async handleAttachSsh(): Promise<void> {
        try {
            await this.attachShell.attachSSH();
        } catch (err: unknown) {
            if (isTopoError(err) && err.code === 'DOCKER') {
                showAndLogError('Failed to attach SSH to the board', err);
                return;
            }
            throw err;
        }
    }

    private async handleBoardDashboardWebviewReady(
        messagePoster: MessagePoster,
    ): Promise<void> {
        await this.renderBoardDashboard(messagePoster);
    }

    /**
     * Handle incoming messages from the webview
     */
    public async handleMessage(
        messagePoster: MessagePoster,
        e: unknown,
    ): Promise<void> {
        try {
            const message = parseBoardDashboardWebviewMessage(e);
            switch (message.type) {
                case 'start-container':
                    await this.handleStartContainer(
                        messagePoster,
                        message.containerId,
                    );
                    return;

                case 'stop-container':
                    await this.handleStopContainer(
                        messagePoster,
                        message.containerId,
                    );
                    return;

                case 'delete-container':
                    await this.handleDeleteContainer(
                        messagePoster,
                        message.containerId,
                    );
                    return;

                case 'open-container-in-browser':
                    await this.handleOpenContainerInBrowser(
                        message.containerId,
                    );
                    return;

                case 'attach-vscode':
                    await this.handleAttachVsCode(message.containerId);
                    return;

                case 'attach-shell':
                    await this.handleAttachShell(message.containerId);
                    return;

                case 'attach-ssh':
                    await this.handleAttachSsh();
                    return;

                case 'board-dashboard-webview-ready':
                    await this.handleBoardDashboardWebviewReady(messagePoster);
                    return;
            }
        } catch (err: unknown) {
            showAndLogError(
                'Unexpected error handling message from board dashboard webview',
                err,
            );
        }
    }
}
