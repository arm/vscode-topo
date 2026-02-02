import * as vscode from 'vscode';
import { BoardDashboardMessageHandler } from './boardDashboardMessageHandler';
import { logger } from '../util/logger';
import { showAndLogError } from '../util/showAndLogError';
import { TopoError } from '../errors/topoError';
import type {
    BoardState,
    ContainerItem,
    ContainersManager,
} from '../workloadPlacement/containersManager';
import { Target } from '../workloadPlacement/target';
import { MessagePoster } from '../util/types';
import { mock } from 'jest-mock-extended';
import type { TargetStore } from '../workloadPlacement/targetStore';
import { ContainerOpenInBrowser } from '../actions/containerOpenInBrowser';
import { AttachVsCode } from '../actions/attachVsCode';
import { AttachShell } from '../actions/attachShell';

jest.mock('vscode');
jest.mock('../util/logger');
jest.mock('../util/showAndLogError', () => ({
    showAndLogError: jest.fn(),
}));

describe('BoardDashboardMessageHandler', () => {
    const postMessage = jest.fn(async () => true);
    const messagePoster: MessagePoster = { postMessage };

    const target = new Target('topo', 'user@topo.local');
    const boardState: BoardState = {
        isReachable: true,
        hasContainerRuntime: true,
        targetId: target.id,
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
        ports: [],
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

    let handler: BoardDashboardMessageHandler;

    beforeEach(() => {
        jest.resetAllMocks();

        containersManager.getContainersData.mockResolvedValue([containerA]);
        containersManager.getBoardState.mockResolvedValue(boardState);

        targetStore.getSelectedTarget.mockResolvedValue(target);

        containerOpenInBrowser.openContainerInBrowser.mockResolvedValue(
            'success',
        );

        handler = new BoardDashboardMessageHandler(
            containersManager,
            targetStore,
            containerOpenInBrowser,
            attachVsCode,
            attachShell,
        );
    });

    describe('renderBoardDashboard', () => {
        it('posts render-board-dashboard message when a target is selected', async () => {
            await handler.renderBoardDashboard(messagePoster);

            expect(messagePoster.postMessage).toHaveBeenCalledWith({
                type: 'render-board-dashboard',
                boardState,
                containersData: [containerA],
                target,
            });
        });

        it('logs an error and does not post when no target is selected', async () => {
            targetStore.getSelectedTarget.mockResolvedValueOnce(undefined);

            await handler.renderBoardDashboard(messagePoster);

            expect(logger.error).toHaveBeenCalledWith(
                'No target selected, cannot render board dashboard',
            );
            expect(messagePoster.postMessage).not.toHaveBeenCalled();
        });
    });

    describe('handleMessage', () => {
        describe('start-container', () => {
            it('handles start-container, logs info, and re-renders', async () => {
                const renderSpy = jest
                    .spyOn(handler, 'renderBoardDashboard')
                    .mockResolvedValue(undefined);

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
                expect(renderSpy).toHaveBeenCalledWith(messagePoster);
            });

            it('shows a TopoError for start-container docker errors and does not re-render', async () => {
                const dockerErr = new TopoError('DOCKER', 'fail');
                containersManager.startContainer.mockRejectedValueOnce(
                    dockerErr,
                );
                const renderSpy = jest.spyOn(handler, 'renderBoardDashboard');

                await handler.handleMessage(messagePoster, {
                    type: 'start-container',
                    containerId: 'a',
                });

                expect(showAndLogError).toHaveBeenCalledWith(
                    'Failed to start the container a',
                    dockerErr,
                );
                expect(renderSpy).not.toHaveBeenCalled();
            });

            it('handles unknown errors by showing an unexpected error', async () => {
                const err = new Error('boom');
                containersManager.startContainer.mockRejectedValueOnce(err);
                const renderSpy = jest.spyOn(handler, 'renderBoardDashboard');

                await handler.handleMessage(messagePoster, {
                    type: 'start-container',
                    containerId: 'a',
                });

                expect(showAndLogError).toHaveBeenCalledWith(
                    'Unexpected error handling message from board dashboard webview',
                    err,
                );
                expect(renderSpy).not.toHaveBeenCalled();
            });
        });

        describe('stop-container', () => {
            it('handles stop-container, logs info, and re-renders', async () => {
                const renderSpy = jest
                    .spyOn(handler, 'renderBoardDashboard')
                    .mockResolvedValue(undefined);

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
                expect(renderSpy).toHaveBeenCalledWith(messagePoster);
            });

            it('handles stop-container docker TopoError and returns early', async () => {
                const dockerErr = new TopoError('DOCKER', 'fail');
                const renderSpy = jest.spyOn(handler, 'renderBoardDashboard');

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
                expect(renderSpy).not.toHaveBeenCalled();
            });

            it('shows an unexpected error when stop-container throws a non-TopoError', async () => {
                const err = new Error('boom');
                containersManager.stopContainer.mockRejectedValueOnce(err);

                await handler.handleMessage(messagePoster, {
                    type: 'stop-container',
                    containerId: 'a',
                });

                expect(showAndLogError).toHaveBeenCalledWith(
                    'Unexpected error handling message from board dashboard webview',
                    err,
                );
            });
        });

        describe('delete-container', () => {
            it('handles delete-container, logs info, and re-renders', async () => {
                const renderSpy = jest
                    .spyOn(handler, 'renderBoardDashboard')
                    .mockResolvedValue(undefined);

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
                expect(renderSpy).toHaveBeenCalledWith(messagePoster);
            });

            it('handles delete-container docker TopoError and returns early', async () => {
                const dockerErr = new TopoError('DOCKER', 'fail');
                const renderSpy = jest.spyOn(handler, 'renderBoardDashboard');

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
                expect(renderSpy).not.toHaveBeenCalled();
            });

            it('shows an unexpected error when delete-container throws a non-TopoError', async () => {
                const err = new Error('boom');
                containersManager.deleteContainer.mockRejectedValueOnce(err);

                await handler.handleMessage(messagePoster, {
                    type: 'delete-container',
                    containerId: 'a',
                });

                expect(showAndLogError).toHaveBeenCalledWith(
                    'Unexpected error handling message from board dashboard webview',
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
                    'Unexpected error handling message from board dashboard webview',
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
                    'Unexpected error handling message from board dashboard webview',
                    new Error('Container with ID a not found'),
                );
                expect(attachVsCode.attachVsCode).not.toHaveBeenCalled();
            });

            it('shows an unexpected error when attach-vscode throws a non-TopoError', async () => {
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
                    'Unexpected error handling message from board dashboard webview',
                    err,
                );
            });

            it('shows a TopoError when attachVsCode fails with docker error', async () => {
                containersManager.getContainersData.mockResolvedValueOnce([
                    containerA,
                ]);
                const dockerErr = new TopoError('DOCKER', 'fail');
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
                    'Unexpected error handling message from board dashboard webview',
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

            it('shows a TopoError when attach-ssh fails with docker error', async () => {
                const dockerErr = new TopoError('DOCKER', 'fail');
                attachShell.attachSSH.mockRejectedValueOnce(dockerErr);

                await handler.handleMessage(messagePoster, {
                    type: 'attach-ssh',
                });

                expect(showAndLogError).toHaveBeenCalledWith(
                    'Failed to attach SSH to the board',
                    dockerErr,
                );
            });

            it('shows an unexpected error when attach-ssh throws a non-TopoError', async () => {
                const err = new Error('boom');
                attachShell.attachSSH.mockRejectedValueOnce(err);

                await handler.handleMessage(messagePoster, {
                    type: 'attach-ssh',
                });

                expect(showAndLogError).toHaveBeenCalledWith(
                    'Unexpected error handling message from board dashboard webview',
                    err,
                );
            });
        });

        it('re-renders when board-dashboard-webview-ready', async () => {
            const renderSpy = jest
                .spyOn(handler, 'renderBoardDashboard')
                .mockResolvedValue(undefined);

            await handler.handleMessage(messagePoster, {
                type: 'board-dashboard-webview-ready',
            });

            expect(renderSpy).toHaveBeenCalledWith(messagePoster);
        });

        it('logs a warning on unknown message type', async () => {
            await handler.handleMessage(messagePoster, {
                type: 'nope',
            });

            expect(showAndLogError).toHaveBeenCalledWith(
                'Unexpected error handling message from board dashboard webview',
                new Error('Unknown message type: nope'),
            );
        });

        it('handles malformed message by showing an unexpected error', async () => {
            await handler.handleMessage(messagePoster, undefined);

            expect(showAndLogError).toHaveBeenCalledWith(
                'Unexpected error handling message from board dashboard webview',
                expect.anything(),
            );
        });
    });
});
