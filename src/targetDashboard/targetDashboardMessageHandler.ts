import * as vscode from 'vscode';
import { logger } from '../util/logger';
import { showAndLogError } from '../util/showAndLogError';
import { ContainersManager } from '../workloadPlacement/containersManager';
import type {
    ContainerItem,
    MessagePoster,
    TargetDestination,
} from '../util/types';
import { ContainerOpenInBrowser } from '../actions/containerOpenInBrowser';
import { AttachVsCode } from '../actions/attachVsCode';
import { AttachShell } from '../actions/attachShell';
import { TargetStore } from '../workloadPlacement/targetStore';
import { isWrappedError } from '../errors/wrappedError';
import { isPlainObject } from '../util/isPlainObject';
import { TargetDescriptionStore } from '../workloadPlacement/targetDescriptionStore';
import { assert, define, enums, Infer, string, type } from 'superstruct';

const containerActionSchema = type({
    containerId: string(),
    target: define<TargetDestination>('TargetDestination', string().validator),
    type: enums(['open-container-in-browser', 'attach-vscode', 'attach-shell']),
});

type ContainerActionMessage = Infer<typeof containerActionSchema>;

type StartContainerMessage = { type: 'start-container'; containerId: string };
type StopContainerMessage = { type: 'stop-container'; containerId: string };
type DeleteContainerMessage = { type: 'delete-container'; containerId: string };
type AttachSshMessage = { type: 'attach-ssh' };
type TargetDashboardWebviewReadyMessage = {
    type: 'target-dashboard-webview-ready';
};

type TargetDashboardWebviewMessage =
    | StartContainerMessage
    | StopContainerMessage
    | DeleteContainerMessage
    | ContainerActionMessage
    | AttachSshMessage
    | TargetDashboardWebviewReadyMessage;

function parseTargetDashboardWebviewMessage(
    value: unknown,
): TargetDashboardWebviewMessage {
    if (!isPlainObject(value) || typeof value.type !== 'string') {
        throw new Error(
            'Invalid webview message: expected an object with a string "type" property',
        );
    }

    switch (value.type) {
        case 'start-container':
        case 'stop-container':
        case 'delete-container':
            if (typeof value.containerId !== 'string') {
                throw new Error(
                    `Invalid message for type "${value.type}": missing or invalid "containerId"`,
                );
            }
            return { type: value.type, containerId: value.containerId };
        case 'open-container-in-browser':
        case 'attach-vscode':
        case 'attach-shell': {
            assert(value, containerActionSchema);
            return value;
        }

        case 'attach-ssh':
        case 'target-dashboard-webview-ready':
            return { type: value.type };

        default:
            throw new Error(`Unknown message type: ${String(value.type)}`);
    }
}

export class TargetDashboardMessageHandler {
    constructor(
        private readonly containersManager: ContainersManager,
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

    private async getContainerById(
        target: TargetDestination,
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
        containerId: string,
    ): Promise<void> {
        try {
            await this.containersManager.startContainer(containerId);
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
        containerId: string,
    ): Promise<void> {
        try {
            await this.containersManager.stopContainer(containerId);
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
        containerId: string,
    ): Promise<void> {
        try {
            await this.containersManager.deleteContainer(containerId);
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

    private async handleOpenContainerInBrowser(
        target: TargetDestination,
        containerId: string,
    ): Promise<void> {
        const container = await this.getContainerById(target, containerId);
        const result =
            await this.containerOpenInBrowser.openContainerInBrowser(container);

        if (result === 'no-web-ports') {
            vscode.window.showWarningMessage(
                `No web ports found for container ${containerId}`,
            );
        }
    }

    private async handleAttachVsCode(
        target: TargetDestination,
        containerId: string,
    ): Promise<void> {
        const container = await this.getContainerById(target, containerId);
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

    private async handleAttachShell(
        target: TargetDestination,
        containerId: string,
    ): Promise<void> {
        const container = await this.getContainerById(target, containerId);
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
        e: unknown,
    ): Promise<void> {
        try {
            const message = parseTargetDashboardWebviewMessage(e);
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
                        message.target,
                        message.containerId,
                    );
                    return;

                case 'attach-vscode':
                    await this.handleAttachVsCode(
                        message.target,
                        message.containerId,
                    );
                    return;

                case 'attach-shell':
                    await this.handleAttachShell(
                        message.target,
                        message.containerId,
                    );
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
