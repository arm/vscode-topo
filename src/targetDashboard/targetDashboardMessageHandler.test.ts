import * as vscode from 'vscode';
import { TargetDashboardMessageHandler } from './targetDashboardMessageHandler';
import { logger } from '../util/logger';
import { showAndLogError } from '../util/showAndLogError';
import { WrappedError } from '../errors/wrappedError';
import type { ContainersManager } from '../workloadPlacement/containersManager';
import type {
    TargetState,
    ContainerItem,
    MessagePoster,
    TargetItem,
    TargetDescription,
} from '../util/types';
import { mock } from 'jest-mock-extended';
import type { TargetStore } from '../workloadPlacement/targetStore';
import { ContainerOpenInBrowser } from '../actions/containerOpenInBrowser';
import { AttachVsCode } from '../actions/attachVsCode';
import { AttachShell } from '../actions/attachShell';
import { TargetDescriptionStore } from '../workloadPlacement/targetDescriptionStore';

jest.mock('../util/logger');
jest.mock('../util/showAndLogError', () => ({
    showAndLogError: jest.fn(),
}));

describe('TargetDashboardMessageHandler', () => {
    const postMessage = jest.fn(async () => true);
    const messagePoster: MessagePoster = { postMessage };

    const target: TargetItem = {
        ssh: 'user@topo.local',
        host: 'topo.local',
    };
    const targetDescription: TargetDescription = {
        hostProcessor: [],
        remoteprocCPU: [{ name: 'imx-rproc' }],
    };
    const targetState: TargetState = {
        health: undefined,
        targetSsh: target.ssh,
    };

    const containerA: ContainerItem = {
        id: 'a',
        name: 'container-a',
        image: 'image-a',
        state: 'running',
        status: 'Up',
        labels: '',
        runningFor: '1s',
        createdAt: 'now',
        runtime: 'docker',
        annotations: {},
        ports: {},
        cpuUsage: '0%',
        memUsage: '0B / 0B',
        target,
    };

    const containerB: ContainerItem = {
        ...containerA,
        id: 'b',
        name: 'container-b',
    };

    const containersManager = mock<ContainersManager>();
    const targetStore = mock<TargetStore>();
    const containerOpenInBrowser = mock<ContainerOpenInBrowser>();
    const attachVsCode = mock<AttachVsCode>();
    const attachShell = mock<AttachShell>();
    const targetDescriptionStore = mock<TargetDescriptionStore>();

    let handler: TargetDashboardMessageHandler;

    beforeEach(() => {
        jest.resetAllMocks();

        containersManager.getContainersData.mockResolvedValue([containerA]);
        containersManager.getTargetState.mockResolvedValue(targetState);

        targetStore.getSelectedTarget.mockResolvedValue(target);
        targetDescriptionStore.getDescription.mockResolvedValue(
            targetDescription,
        );

        containerOpenInBrowser.openContainerInBrowser.mockResolvedValue(
            'success',
        );

        handler = new TargetDashboardMessageHandler(
            containersManager,
            targetStore,
            targetDescriptionStore,
            containerOpenInBrowser,
            attachVsCode,
            attachShell,
        );
    });

    describe('renderTargetDashboard', () => {
        it('posts render-target-dashboard message when a target is selected', async () => {
            await handler.renderTargetDashboard(messagePoster);

            expect(messagePoster.postMessage).toHaveBeenCalledWith({
                type: 'render-target-dashboard',
                targetState,
                containersData: [containerA],
                target,
                subsystems: ['Host', 'imx-rproc'],
            });
        });

        it('logs an error and does not post when no target is selected', async () => {
            targetStore.getSelectedTarget.mockResolvedValueOnce(undefined);

            await handler.renderTargetDashboard(messagePoster);

            expect(logger.error).toHaveBeenCalledWith(
                'No target selected, cannot render target dashboard',
            );
            expect(messagePoster.postMessage).not.toHaveBeenCalled();
        });
    });

    describe('handleMessage', () => {
        describe('start-container', () => {
            it('handles start-container, logs info, and re-renders', async () => {
                await handler.handleMessage(messagePoster, {
                    type: 'start-container',
                    containerId: 'a',
                });

                expect(containersManager.startContainer).toHaveBeenCalledWith(
                    'a',
                );
                expect(logger.info).toHaveBeenCalledWith(
                    'Container a started successfully',
                );
                expect(messagePoster.postMessage).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: 'render-target-dashboard',
                    }),
                );
            });

            it('shows a WrappedError for start-container docker errors and does not re-render', async () => {
                const dockerErr = new WrappedError('DOCKER', 'fail');
                containersManager.startContainer.mockRejectedValueOnce(
                    dockerErr,
                );

                await handler.handleMessage(messagePoster, {
                    type: 'start-container',
                    containerId: 'a',
                });

                expect(showAndLogError).toHaveBeenCalledWith(
                    'Failed to start the container a',
                    dockerErr,
                );
                expect(messagePoster.postMessage).not.toHaveBeenCalled();
            });

            it('handles unknown errors by showing an unexpected error', async () => {
                const err = new Error('boom');
                containersManager.startContainer.mockRejectedValueOnce(err);

                await handler.handleMessage(messagePoster, {
                    type: 'start-container',
                    containerId: 'a',
                });

                expect(showAndLogError).toHaveBeenCalledWith(
                    'Unexpected error handling message from target dashboard webview',
                    err,
                );
                expect(messagePoster.postMessage).not.toHaveBeenCalled();
            });
        });

        describe('stop-container', () => {
            it('handles stop-container, logs info, and re-renders', async () => {
                await handler.handleMessage(messagePoster, {
                    type: 'stop-container',
                    containerId: 'a',
                });

                expect(containersManager.stopContainer).toHaveBeenCalledWith(
                    'a',
                );
                expect(logger.info).toHaveBeenCalledWith(
                    'Container a stopped successfully',
                );
                expect(messagePoster.postMessage).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: 'render-target-dashboard',
                    }),
                );
            });

            it('handles stop-container docker WrappedError and returns early', async () => {
                const dockerErr = new WrappedError('DOCKER', 'fail');

                containersManager.stopContainer.mockRejectedValueOnce(
                    dockerErr,
                );

                await handler.handleMessage(messagePoster, {
                    type: 'stop-container',
                    containerId: 'a',
                });

                expect(showAndLogError).toHaveBeenCalledWith(
                    'Failed to stop the container a',
                    dockerErr,
                );
                expect(messagePoster.postMessage).not.toHaveBeenCalled();
            });

            it('shows an unexpected error when stop-container throws a generic error', async () => {
                const err = new Error('boom');
                containersManager.stopContainer.mockRejectedValueOnce(err);

                await handler.handleMessage(messagePoster, {
                    type: 'stop-container',
                    containerId: 'a',
                });

                expect(showAndLogError).toHaveBeenCalledWith(
                    'Unexpected error handling message from target dashboard webview',
                    err,
                );
                expect(messagePoster.postMessage).not.toHaveBeenCalled();
            });
        });

        describe('delete-container', () => {
            it('handles delete-container, logs info, and re-renders', async () => {
                await handler.handleMessage(messagePoster, {
                    type: 'delete-container',
                    containerId: 'a',
                });

                expect(containersManager.deleteContainer).toHaveBeenCalledWith(
                    'a',
                );
                expect(logger.info).toHaveBeenCalledWith(
                    'Container a deleted successfully',
                );
                expect(messagePoster.postMessage).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: 'render-target-dashboard',
                    }),
                );
            });

            it('handles delete-container docker WrappedError and returns early', async () => {
                const dockerErr = new WrappedError('DOCKER', 'fail');

                containersManager.deleteContainer.mockRejectedValueOnce(
                    dockerErr,
                );

                await handler.handleMessage(messagePoster, {
                    type: 'delete-container',
                    containerId: 'a',
                });

                expect(showAndLogError).toHaveBeenCalledWith(
                    'Failed to delete the container a',
                    dockerErr,
                );
                expect(messagePoster.postMessage).not.toHaveBeenCalled();
            });

            it('shows an unexpected error when delete-container throws a generic error', async () => {
                const err = new Error('boom');
                containersManager.deleteContainer.mockRejectedValueOnce(err);

                await handler.handleMessage(messagePoster, {
                    type: 'delete-container',
                    containerId: 'a',
                });

                expect(showAndLogError).toHaveBeenCalledWith(
                    'Unexpected error handling message from target dashboard webview',
                    err,
                );
            });
        });

        describe('open-container-in-browser', () => {
            it('logs a warning when container is not found for open-container-in-browser', async () => {
                containersManager.getContainersData.mockResolvedValueOnce([
                    containerB,
                ]);

                await handler.handleMessage(messagePoster, {
                    type: 'open-container-in-browser',
                    containerId: 'a',
                });

                expect(showAndLogError).toHaveBeenCalledWith(
                    'Unexpected error handling message from target dashboard webview',
                    new Error('Container with ID a not found'),
                );
                expect(
                    containerOpenInBrowser.openContainerInBrowser,
                ).not.toHaveBeenCalled();
            });

            it('opens container in browser when container exists and does not warn on success', async () => {
                containersManager.getContainersData.mockResolvedValueOnce([
                    containerA,
                ]);
                containerOpenInBrowser.openContainerInBrowser.mockResolvedValueOnce(
                    'success',
                );

                await handler.handleMessage(messagePoster, {
                    type: 'open-container-in-browser',
                    containerId: 'a',
                });

                expect(
                    containerOpenInBrowser.openContainerInBrowser,
                ).toHaveBeenCalledWith(containerA);
                expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
            });

            it('shows a warning when openContainerInBrowser returns no-web-ports', async () => {
                containersManager.getContainersData.mockResolvedValueOnce([
                    containerA,
                ]);
                containerOpenInBrowser.openContainerInBrowser.mockResolvedValueOnce(
                    'no-web-ports',
                );

                await handler.handleMessage(messagePoster, {
                    type: 'open-container-in-browser',
                    containerId: 'a',
                });

                expect(
                    containerOpenInBrowser.openContainerInBrowser,
                ).toHaveBeenCalledWith(containerA);
                expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
                    'No web ports found for container a',
                );
            });
        });

        describe('attach-vscode', () => {
            it('attaches VS Code when container is found', async () => {
                containersManager.getContainersData.mockResolvedValueOnce([
                    containerA,
                ]);

                await handler.handleMessage(messagePoster, {
                    type: 'attach-vscode',
                    containerId: 'a',
                });

                expect(attachVsCode.attachVsCode).toHaveBeenCalledWith(
                    containerA,
                );
            });

            it('logs a warning when container is not found for attach-vscode', async () => {
                containersManager.getContainersData.mockResolvedValueOnce([
                    containerB,
                ]);

                await handler.handleMessage(messagePoster, {
                    type: 'attach-vscode',
                    containerId: 'a',
                });

                expect(showAndLogError).toHaveBeenCalledWith(
                    'Unexpected error handling message from target dashboard webview',
                    new Error('Container with ID a not found'),
                );
                expect(attachVsCode.attachVsCode).not.toHaveBeenCalled();
            });

            it('shows an unexpected error when attach-vscode throws a generic error', async () => {
                containersManager.getContainersData.mockResolvedValueOnce([
                    containerA,
                ]);
                const err = new Error('boom');
                attachVsCode.attachVsCode.mockRejectedValueOnce(err);

                await handler.handleMessage(messagePoster, {
                    type: 'attach-vscode',
                    containerId: 'a',
                });

                expect(showAndLogError).toHaveBeenCalledWith(
                    'Unexpected error handling message from target dashboard webview',
                    err,
                );
            });

            it('shows a WrappedError when attachVsCode fails with docker error', async () => {
                containersManager.getContainersData.mockResolvedValueOnce([
                    containerA,
                ]);
                const dockerErr = new WrappedError('DOCKER', 'fail');
                attachVsCode.attachVsCode.mockRejectedValueOnce(dockerErr);

                await handler.handleMessage(messagePoster, {
                    type: 'attach-vscode',
                    containerId: 'a',
                });

                expect(showAndLogError).toHaveBeenCalledWith(
                    'Failed to attach VS Code to the container a',
                    dockerErr,
                );
            });
        });

        describe('attach-shell', () => {
            it('attaches shell when container is found', async () => {
                containersManager.getContainersData.mockResolvedValueOnce([
                    containerA,
                ]);

                await handler.handleMessage(messagePoster, {
                    type: 'attach-shell',
                    containerId: 'a',
                });

                expect(attachShell.attachShell).toHaveBeenCalledWith(
                    containerA,
                );
            });

            it('logs a warning when container is not found for attach-shell', async () => {
                containersManager.getContainersData.mockResolvedValueOnce([
                    containerB,
                ]);

                await handler.handleMessage(messagePoster, {
                    type: 'attach-shell',
                    containerId: 'a',
                });

                expect(showAndLogError).toHaveBeenCalledWith(
                    'Unexpected error handling message from target dashboard webview',
                    new Error('Container with ID a not found'),
                );
                expect(attachShell.attachShell).not.toHaveBeenCalled();
            });
        });

        describe('attach-ssh', () => {
            it('attaches SSH successfully', async () => {
                await handler.handleMessage(messagePoster, {
                    type: 'attach-ssh',
                });

                expect(attachShell.attachSSH).toHaveBeenCalled();
                expect(showAndLogError).not.toHaveBeenCalled();
            });

            it('shows a WrappedError when attach-ssh fails with docker error', async () => {
                const dockerErr = new WrappedError('DOCKER', 'fail');
                attachShell.attachSSH.mockRejectedValueOnce(dockerErr);

                await handler.handleMessage(messagePoster, {
                    type: 'attach-ssh',
                });

                expect(showAndLogError).toHaveBeenCalledWith(
                    'Failed to attach SSH to the target',
                    dockerErr,
                );
            });

            it('shows an unexpected error when attach-ssh throws a generic error', async () => {
                const err = new Error('boom');
                attachShell.attachSSH.mockRejectedValueOnce(err);

                await handler.handleMessage(messagePoster, {
                    type: 'attach-ssh',
                });

                expect(showAndLogError).toHaveBeenCalledWith(
                    'Unexpected error handling message from target dashboard webview',
                    err,
                );
            });
        });

        it('re-renders when target-dashboard-webview-ready', async () => {
            await handler.handleMessage(messagePoster, {
                type: 'target-dashboard-webview-ready',
            });

            expect(messagePoster.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'render-target-dashboard',
                }),
            );
        });

        it('logs a warning on unknown message type', async () => {
            await handler.handleMessage(messagePoster, {
                type: 'nope',
            });

            expect(showAndLogError).toHaveBeenCalledWith(
                'Unexpected error handling message from target dashboard webview',
                new Error('Unknown message type: nope'),
            );
        });

        it('handles malformed message by showing an unexpected error', async () => {
            await handler.handleMessage(messagePoster, undefined);

            expect(showAndLogError).toHaveBeenCalledWith(
                'Unexpected error handling message from target dashboard webview',
                expect.anything(),
            );
        });
    });
});
