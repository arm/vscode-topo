import * as vscode from 'vscode';
import { logger } from '../util/logger';
import { ContainersManager } from '../workloadPlacement/containersManager';
import { ContainerOpenInBrowser } from '../actions/containerOpenInBrowser';
import { AttachVsCode } from '../actions/attachVsCode';
import { AttachShell } from '../actions/attachShell';
import { TargetStore } from '../workloadPlacement/targetStore';

export class BoardDashboardMessageHandler {
    constructor(
        private readonly containersManager: ContainersManager,
        private readonly targetStore: Pick<TargetStore, 'getSelectedTarget'>,
        private readonly containerOpenInBrowser: ContainerOpenInBrowser,
        private readonly attachVsCode: AttachVsCode,
        private readonly attachShell: AttachShell,
    ) {
    }

    public async renderBoardDashboard(
        webview: vscode.Webview
    ): Promise<void> {
        const containersData = await this.containersManager.getContainersData();
        const boardState = await this.containersManager.getBoardState();
        const target = await this.targetStore.getSelectedTarget();
        if (!target) {
            logger.error('No target selected, cannot render board dashboard');
            return;
        }
        webview.postMessage({
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
        webview: vscode.Webview,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        e: any
    ): Promise<void> {
        switch (e.type) {
        case 'start-container':
            try {
                await this.containersManager.startContainer(e.containerId);
                logger.info(`Container ${e.containerId} started successfully`);
                this.renderBoardDashboard(webview);
            } catch (err: unknown) {
                logger.error(`Failed to start the container ${e.containerId}`, err);
            }
            break;
        case 'stop-container':
            try {
                await this.containersManager.stopContainer(e.containerId);
                logger.info(`Container ${e.containerId} stopped successfully`);
                this.renderBoardDashboard(webview);
            } catch (err: unknown) {
                logger.error(`Failed to stop the container ${e.containerId}`, err);
            }
            break;
        case 'delete-container':
            try {
                await this.containersManager.deleteContainer(e.containerId);
                logger.info(`Container ${e.containerId} deleted successfully`);
                this.renderBoardDashboard(webview);
            } catch (err: unknown) {
                logger.error(`Failed to delete the container ${e.containerId}`, err);
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
                logger.error(`Failed to open the container ${e.containerId} in browser`, err);
            }
            break;
        case 'attach-vscode':
            try {
                const containersData = await this.containersManager.getContainersData();
                const container = containersData.find(c => c.id === e.containerId);
                if (!container) {
                    logger.warn(`Container with ID ${e.containerId} not found`);
                } else {
                    await this.attachVsCode.attachVsCodeToContainer(container);
                }
            } catch (err: unknown) {
                logger.error(`Failed to attach VS Code to the container ${e.containerId}`, err);
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
                logger.error(`Failed to attach a shell to the container ${e.containerId}`, err);
            }
            break;
        case 'attach-ssh':
            try {
                await this.attachShell.attachSSH();
            } catch (err: unknown) {
                logger.error(`Failed to attach via SSH to the Host`, err);
            }
            break;
        case 'board-dashboard-webview-ready':
            this.renderBoardDashboard(webview);
            break;
        default:
            logger.warn(`Unknown message type: ${e.type}`);
        }
    }
}
