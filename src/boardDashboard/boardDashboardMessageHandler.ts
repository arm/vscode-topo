import * as vscode from 'vscode';
import { logger } from '../util/logger';
import { ContainersManager } from '../workloadPlacement/containersManager';
import { ContainerOpenInBrowser } from '../actions/containerOpenInBrowser';
import { AttachVscode } from '../actions/attachVscode';
import { AttachShell } from '../actions/attachShell';

export class BoardDashboardMessageHandler {
    constructor(
        private readonly containersManager: ContainersManager,
    private readonly containerOpenInBrowser: ContainerOpenInBrowser,
    private readonly attachVscode: AttachVscode,
    private readonly attachShell: AttachShell,
    ) {
    }

    public async renderBoardDashboard(
        webview: vscode.Webview
    ): Promise<void> {
        const containersData = await this.containersManager.getContainersData();
        const boardState = await this.containersManager.getBoardState();
        webview.postMessage({
            type: 'render-board-dashboard',
            boardState,
            containersData
        });
    }

    /**
     * Handle incoming messages from the webview
     */
    public async handleMessage(
        webview: vscode.Webview,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        e: any
    ): Promise<void> {
        logger.debug(`Received message from webview: ${e.type}`);
        switch (e.type) {
        case 'start-container':
            try {
                await this.containersManager.startContainer(e.containerId);
                logger.info(`Container ${e.containerId} started successfully`);
                this.renderBoardDashboard(webview);
            } catch (err: unknown) {
                logger.error(`Failed to start container ${e.containerId}: ${err instanceof Error ? err.message : "Unknown error"}`);
            }
            break;
        case 'stop-container':
            try {
                await this.containersManager.stopContainer(e.containerId);
                logger.info(`Container ${e.containerId} stopped successfully`);
                this.renderBoardDashboard(webview);
            } catch (err: unknown) {
                logger.error(`Failed to stop container ${e.containerId}: ${err instanceof Error ? err.message : "Unknown error"}`);
            }
            break;
        case 'delete-container':
            try {
                await this.containersManager.deleteContainer(e.containerId);
                logger.info(`Container ${e.containerId} deleted successfully`);
                this.renderBoardDashboard(webview);
            } catch (err: unknown) {
                logger.error(`Failed to delete container ${e.containerId}: ${err instanceof Error ? err.message : "Unknown error"}`);
            }
            break;
        case 'open-container-in-browser':
            try {
                const containersData = await this.containersManager.getContainersData();
                const container = containersData.find(c => c.id === e.containerId);
                if (!container) {
                    logger.warn(`Container with ID ${e.containerId} not found`);
                } else {
                    await this.containerOpenInBrowser.openContainerInBrowser(container);
                }
            } catch (err: unknown) {
                logger.error(`Failed to open container in browser: ${err instanceof Error ? err.message : "Unknown error"}`);
            }
            break;
        case 'attach-vscode':
            try {
                const containersData = await this.containersManager.getContainersData();
                const container = containersData.find(c => c.id === e.containerId);
                if (!container) {
                    logger.warn(`Container with ID ${e.containerId} not found`);
                } else {
                    await this.attachVscode.attachVsCodeToContainer(container);
                }
            } catch (err: unknown) {
                logger.error(`Failed to attach VS Code to container: ${err instanceof Error ? err.message : "Unknown error"}`);
            }
            break;
        case 'attach-shell':
            try {
                const containersData = await this.containersManager.getContainersData();
                const container = containersData.find(c => c.id === e.containerId);
                if (!container) {
                    logger.warn(`Container with ID ${e.containerId} not found`);
                } else {
                    await this.attachShell.attachShell(container);
                }
            } catch (err: unknown) {
                logger.error(`Failed to attach sshto container: ${err instanceof Error ? err.message : "Unknown error"}`);
            }
            break;
        case 'attach-ssh':
            try {
                await this.attachShell.attachSSH();
            } catch (err: unknown) {
                logger.error(`Failed to attach via SSH to the Host: ${err instanceof Error ? err.message : "Unknown error"}`);
            }
            break;
        case 'board-dashboard-webview-ready':
            this.renderBoardDashboard(webview);
            break;
        default:
            console.warn(`Unknown message type: ${e.type}`);
        }
    }
}
