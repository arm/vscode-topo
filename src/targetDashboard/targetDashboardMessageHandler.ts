import * as vscode from 'vscode';
import { logger } from '../util/logger';
import { showAndLogError } from '../util/showAndLogError';
import { ContainersManager } from '../workloadPlacement/containersManager';
import type { ContainerItem, MessagePoster } from '../util/types';
import { ContainerOpenInBrowser } from '../actions/containerOpenInBrowser';
import { AttachVsCode } from '../actions/attachVsCode';
import { AttachShell } from '../actions/attachShell';
import { TargetStore } from '../workloadPlacement/targetStore';
import { isWrappedError } from '../errors/wrappedError';
import { TargetDescriptionStore } from '../workloadPlacement/targetDescriptionStore';
import { assert, enums, Infer, string, type, union } from 'superstruct';
import { ContainerCommands } from '../workloadPlacement/containerCommands';

const containerActionMessageSchema = type({
    containerId: string(),
    target: string(),
    type: enums([
        'open-container-in-browser',
        'attach-vscode',
        'attach-shell',
        'start-container',
        'stop-container',
        'delete-container',
    ]),
});

type ContainerActionMessage = Infer<typeof containerActionMessageSchema>;

const messageSchema = union([
    containerActionMessageSchema,
    type({
        type: enums(['target-dashboard-webview-ready', 'attach-ssh']),
    }),
]);

export type TargetDashboardMessage = Infer<typeof messageSchema>;

export class TargetDashboardMessageHandler {
    constructor(
        private readonly containersManager: ContainersManager,
        private readonly containerCommands: ContainerCommands,
        private readonly targetStore: TargetStore,
        private readonly targetDescriptionStore: TargetDescriptionStore,
        private readonly containerOpenInBrowser: ContainerOpenInBrowser,
        private readonly attachVsCode: AttachVsCode,
        private readonly attachShell: AttachShell,
    ) {}

    public async renderTargetDashboard(
        messagePoster: MessagePoster,
    ): Promise<void> {
        const target = await this.targetStore.getSelectedTarget();
        if (!target) {
            logger.error('No target selected, cannot render target dashboard');
            return;
        }
        const [targetDescription, targetState, containersData] =
            await Promise.all([
                this.targetDescriptionStore.getDescription(target),
                this.containersManager.getTargetState(target),
                this.containersManager.getContainersData(target),
            ]);

        const remoteprocCpus =
            targetDescription?.remoteprocCpus.map((rp) => rp.name) || [];
        const subsystems = ['Host', ...remoteprocCpus];
        await messagePoster.postMessage({
            type: 'render-target-dashboard',
            targetState,
            containersData,
            target,
            subsystems,
        });
    }

    private async getContainer(
        target: string,
        containerId: string,
    ): Promise<ContainerItem> {
        const containersData =
            await this.containersManager.getContainersData(target);
        const container = containersData.find((c) => c.id === containerId);
        if (!container) {
            throw new Error(`Container with ID ${containerId} not found`);
        }
        return container;
    }

    private async handleStartContainer(
        messagePoster: MessagePoster,
        { containerId, target }: ContainerActionMessage,
    ): Promise<void> {
        try {
            await this.containerCommands.startContainer(containerId, target);
        } catch (err: unknown) {
            if (isWrappedError(err, ['DOCKER'])) {
                return showAndLogError(
                    `Failed to start the container ${containerId}`,
                    err,
                );
            }
            throw err;
        }

        logger.info(`Container ${containerId} started successfully`);
        await this.renderTargetDashboard(messagePoster);
    }

    private async handleStopContainer(
        messagePoster: MessagePoster,
        { containerId, target }: ContainerActionMessage,
    ): Promise<void> {
        try {
            await this.containerCommands.stopContainer(containerId, target);
        } catch (err: unknown) {
            if (isWrappedError(err, ['DOCKER'])) {
                return showAndLogError(
                    `Failed to stop the container ${containerId}`,
                    err,
                );
            }
            throw err;
        }

        logger.info(`Container ${containerId} stopped successfully`);
        await this.renderTargetDashboard(messagePoster);
    }

    private async handleDeleteContainer(
        messagePoster: MessagePoster,
        { containerId, target }: ContainerActionMessage,
    ): Promise<void> {
        try {
            await this.containerCommands.deleteContainer(containerId, target);
        } catch (err: unknown) {
            if (isWrappedError(err, ['DOCKER'])) {
                return showAndLogError(
                    `Failed to delete the container ${containerId}`,
                    err,
                );
            }
            throw err;
        }

        logger.info(`Container ${containerId} deleted successfully`);
        await this.renderTargetDashboard(messagePoster);
    }

    private async handleOpenContainerInBrowser({
        containerId,
        target,
    }: ContainerActionMessage): Promise<void> {
        const container = await this.getContainer(target, containerId);
        const result =
            await this.containerOpenInBrowser.openContainerInBrowser(container);

        if (result === 'no-web-ports') {
            vscode.window.showWarningMessage(
                `No web ports found for container ${containerId}`,
            );
        }
    }

    private async handleAttachVsCode({
        containerId,
        target,
    }: ContainerActionMessage): Promise<void> {
        const container = await this.getContainer(target, containerId);
        try {
            await this.attachVsCode.attachVsCode(container);
        } catch (err: unknown) {
            if (isWrappedError(err, ['DOCKER'])) {
                return showAndLogError(
                    `Failed to attach VS Code to the container ${containerId}`,
                    err,
                );
            }
            throw err;
        }
    }

    private async handleAttachShell({
        containerId,
        target,
    }: ContainerActionMessage): Promise<void> {
        const container = await this.getContainer(target, containerId);
        this.attachShell.attachShell(container);
    }

    private async handleAttachSsh(): Promise<void> {
        try {
            await this.attachShell.attachSSH();
        } catch (err: unknown) {
            if (isWrappedError(err, ['DOCKER'])) {
                return showAndLogError(
                    'Failed to attach SSH to the target',
                    err,
                );
            }
            throw err;
        }
    }

    private async handleTargetDashboardWebviewReady(
        messagePoster: MessagePoster,
    ): Promise<void> {
        await this.renderTargetDashboard(messagePoster);
    }

    /**
     * Handle incoming messages from the webview
     */
    public async handleMessage(
        messagePoster: MessagePoster,
        message: unknown,
    ): Promise<void> {
        try {
            assert(
                message,
                messageSchema,
                'Invalid message received from target dashboard',
            );
            switch (message.type) {
                case 'start-container':
                    await this.handleStartContainer(messagePoster, message);
                    return;

                case 'stop-container':
                    await this.handleStopContainer(messagePoster, message);
                    return;

                case 'delete-container':
                    await this.handleDeleteContainer(messagePoster, message);
                    return;

                case 'open-container-in-browser':
                    await this.handleOpenContainerInBrowser(message);
                    return;

                case 'attach-vscode':
                    await this.handleAttachVsCode(message);
                    return;

                case 'attach-shell':
                    await this.handleAttachShell(message);
                    return;

                case 'attach-ssh':
                    await this.handleAttachSsh();
                    return;

                case 'target-dashboard-webview-ready':
                    await this.handleTargetDashboardWebviewReady(messagePoster);
                    return;
            }
        } catch (err: unknown) {
            showAndLogError(
                'Unexpected error handling message from target dashboard webview',
                err,
            );
        }
    }
}
